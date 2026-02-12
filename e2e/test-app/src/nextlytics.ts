import { Nextlytics } from "@nextlytics/core/server";
import type { BackendConfigEntry } from "@nextlytics/core";
import { postgrestBackend } from "@nextlytics/core/backends/postgrest";
import type { NextlyticsBackend } from "@nextlytics/core";
import { auth } from "./auth";

// Inline types for test backend (avoid import issues with workspace)
type ScriptElement = { async?: boolean; body?: string; src?: string };
type JavascriptTemplate = {
  items: ScriptElement[];
  deps?: string | string[];
};
type ClientAction = {
  items: Array<{ type: "script-template"; templateId: string; params: unknown }>;
};

const CONSOLE_INIT_TEMPLATE_ID = "console-test-init";
const CONSOLE_CONFIG_TEMPLATE_ID = "console-test-config";
const CONSOLE_EVENT_TEMPLATE_ID = "console-test-event";
const TEST_MEASUREMENT_ID = "TEST-MEASUREMENT-ID";

/**
 * Test backend that mirrors GA-like behavior:
 * - init template (loader) runs once (measurementId is stable)
 * - config template re-runs only when config changes
 * - event template runs for every event
 */
function consoleTestBackend(): NextlyticsBackend {
  return {
    name: "console-test",
    returnsClientActions: true,

    getClientSideTemplates(): Record<string, JavascriptTemplate> {
      return {
        [CONSOLE_INIT_TEMPLATE_ID]: {
          deps: "{{measurementId}}",
          items: [
            {
              body: [
                "window.__nextlyticsTestInit = (window.__nextlyticsTestInit || 0) + 1;",
                "console.log('[nextlytics-test] init:', window.__nextlyticsTestInit);",
              ].join("\n"),
            },
          ],
        },
        [CONSOLE_CONFIG_TEMPLATE_ID]: {
          deps: "{{stableHash(config)}}",
          items: [
            {
              body: [
                "window.__nextlyticsTestConfig = (window.__nextlyticsTestConfig || 0) + 1;",
                "console.log('[nextlytics-test] config:', window.__nextlyticsTestConfig, {{json(config)}});",
              ].join("\n"),
            },
          ],
        },
        [CONSOLE_EVENT_TEMPLATE_ID]: {
          deps: "{{eventId}}",
          items: [
            {
              body: [
                "window.__nextlyticsTestEvent = (window.__nextlyticsTestEvent || 0) + 1;",
                "console.log('[nextlytics-test] event:', window.__nextlyticsTestEvent);",
              ].join("\n"),
            },
          ],
        },
      };
    },

    async onEvent(event): Promise<ClientAction> {
      // Return script insertion for pageView events
      if (event.type === "pageView") {
        const config = {
          path: event.serverContext?.path || "/",
        };
        return {
          items: [
            {
              type: "script-template",
              templateId: CONSOLE_INIT_TEMPLATE_ID,
              params: { measurementId: TEST_MEASUREMENT_ID },
            },
            {
              type: "script-template",
              templateId: CONSOLE_CONFIG_TEMPLATE_ID,
              params: { config },
            },
            {
              type: "script-template",
              templateId: CONSOLE_EVENT_TEMPLATE_ID,
              params: { eventId: event.eventId, path: config.path },
            },
          ],
        };
      }
      return { items: [] };
    },

    updateEvent() {},
  };
}

const backends: BackendConfigEntry[] = [
  // Immediate backend - receives events in middleware (no client context initially)
  postgrestBackend({
    url: process.env.POSTGREST_URL || "http://localhost:3001",
    tableName: "analytics",
  }),
  // Delayed backend - receives events on client-init (has full client context)
  {
    backend: postgrestBackend({
      url: process.env.POSTGREST_URL || "http://localhost:3001",
      tableName: "analytics_delayed",
    }),
    ingestPolicy: "on-client-event",
  },
  consoleTestBackend(),
];

export const { middleware, analytics, NextlyticsServer } = Nextlytics({
  backends,
  debug: true,
  callbacks: {
    async getUser() {
      const session = await auth();
      if (!session?.user?.id) return undefined;
      return {
        userId: session.user.id,
        traits: {
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
        },
      };
    },
  },
});
