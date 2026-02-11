import type {
  ClientAction,
  JavascriptTemplate,
  NextlyticsBackend,
  NextlyticsEvent,
} from "../types";

const LOG_TEMPLATE_ID = "log-console";

export function loggingBackend(): NextlyticsBackend {
  return {
    name: "logging",
    supportsUpdates: true,
    returnsClientActions: true,

    getClientSideTemplates(): Record<string, JavascriptTemplate> {
      return {
        [LOG_TEMPLATE_ID]: {
          items: [
            {
              body: "console.log('[Nextlytics Log][client]', {{json(event)}});",
              mode: "every-render",
            },
          ],
        },
      };
    },

    async onEvent(event: NextlyticsEvent): Promise<ClientAction | undefined> {
      const { type, eventId, serverContext, ...rest } = event;
      const method = serverContext?.method || "";
      const path = serverContext?.path || "";

      const route = method && path ? `${method} ${path}` : "";
      console.log(`[Nextlytics Log] ${type}${route ? ` ${route}` : ""} (${eventId})`);
      console.log(JSON.stringify({ serverContext, ...rest }, null, 2));

      if (event.origin === "client") {
        return {
          items: [
            {
              type: "script-template",
              templateId: LOG_TEMPLATE_ID,
              params: {
                event: {
                  type: event.type,
                  eventProps: event.properties,
                  userProps: event.userContext,
                },
              },
            },
          ],
        };
      }
      return undefined;
    },

    updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): void {
      console.log(`[Nextlytics Log] Update ${eventId}`);
      console.log(JSON.stringify(patch, null, 2));
    },
  };
}
