import { Nextlytics } from "@nextlytics/core/server";
import type { BackendConfigEntry } from "@nextlytics/core";
import { postgrestBackend } from "@nextlytics/core/backends/postgrest";
import type { NextlyticsBackend } from "@nextlytics/core";
import { auth } from "./auth";

// Inline types for test backend (avoid import issues with workspace)
type ScriptMode = "once" | "on-params-change" | "every-render";
type ScriptElement = { async?: boolean; body?: string; src?: string; mode?: ScriptMode };
type JavascriptTemplate = { items: ScriptElement[] };
type ClientAction = {
  items: Array<{ type: "script-template"; templateId: string; params: unknown }>;
};

const CONSOLE_TEMPLATE_ID = "console-test";

/**
 * Test backend that injects console.log scripts with different modes.
 * Used to verify script injection behavior during soft navigation.
 */
function consoleTestBackend(): NextlyticsBackend {
  return {
    name: "console-test",
    returnsClientActions: true,

    getClientSideTemplates(): Record<string, JavascriptTemplate> {
      return {
        [CONSOLE_TEMPLATE_ID]: {
          items: [
            // mode: "once" - should only run once, even after soft navigation
            {
              body: [
                "window.__nextlyticsTestOnce = (window.__nextlyticsTestOnce || 0) + 1;",
                "console.log('[nextlytics-test] once:', window.__nextlyticsTestOnce);",
              ].join("\n"),
              mode: "once",
            },
            // mode: "on-params-change" - should run when params change
            {
              body: [
                "window.__nextlyticsTestParamsChange = (window.__nextlyticsTestParamsChange || 0) + 1;",
                "console.log('[nextlytics-test] on-params-change:', window.__nextlyticsTestParamsChange, 'path={{path}}');",
              ].join("\n"),
              mode: "on-params-change",
            },
            // mode: "every-render" (default) - should run on every navigation
            {
              body: [
                "window.__nextlyticsTestEveryRender = (window.__nextlyticsTestEveryRender || 0) + 1;",
                "console.log('[nextlytics-test] every-render:', window.__nextlyticsTestEveryRender);",
              ].join("\n"),
            },
          ],
        },
      };
    },

    async onEvent(event): Promise<ClientAction> {
      // Return script insertion for pageView events
      if (event.type === "pageView") {
        return {
          items: [
            {
              type: "script-template",
              templateId: CONSOLE_TEMPLATE_ID,
              params: { path: event.serverContext?.path || "/" },
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

export const { middleware, analytics, Server, getNextlyticsProps } = Nextlytics({
  backends,
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
