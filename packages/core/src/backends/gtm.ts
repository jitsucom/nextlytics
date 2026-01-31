import type {
  ClientAction,
  JavascriptTemplate,
  NextlyticsBackend,
  NextlyticsEvent,
} from "../types";

export type GoogleTagManagerBackendOptions = {
  /** GTM Container ID (e.g. "GTM-XXXXXXX") */
  containerId: string;
};

type GTMInitParams = {
  containerId: string;
  initialData: Record<string, unknown>;
};

type GTMPageViewParams = {
  pageData: Record<string, unknown>;
};

type GTMEventParams = {
  eventData: Record<string, unknown>;
};

const GTM_INIT_TEMPLATE_ID = "gtm-init";
const GTM_PAGEVIEW_TEMPLATE_ID = "gtm-pageview";
const GTM_EVENT_TEMPLATE_ID = "gtm-event";

/** Convert event type to snake_case */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

export function googleTagManagerBackend(opts: GoogleTagManagerBackendOptions): NextlyticsBackend {
  const { containerId } = opts;

  return {
    name: "google-tag-manager",
    returnsClientActions: true,
    supportsUpdates: false,

    getClientSideTemplates(): Record<string, JavascriptTemplate> {
      return {
        [GTM_INIT_TEMPLATE_ID]: {
          items: [
            {
              body: [
                "window.dataLayer = window.dataLayer || [];",
                "dataLayer.push({{json(initialData)}});",
                "if (!window.google_tag_manager || !window.google_tag_manager['{{containerId}}']) {",
                "  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':",
                "  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],",
                "  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=",
                "  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);",
                "  })(window,document,'script','dataLayer','{{containerId}}');",
                "}",
              ].join("\n"),
            },
          ],
        },
        [GTM_PAGEVIEW_TEMPLATE_ID]: {
          items: [
            {
              body: [
                "window.dataLayer = window.dataLayer || [];",
                "dataLayer.push({{json(pageData)}});",
              ].join("\n"),
            },
          ],
        },
        [GTM_EVENT_TEMPLATE_ID]: {
          items: [
            {
              body: [
                "window.dataLayer = window.dataLayer || [];",
                "dataLayer.push({{json(eventData)}});",
              ].join("\n"),
            },
          ],
        },
      };
    },

    async onEvent(event: NextlyticsEvent): Promise<void | ClientAction> {
      // Handle custom events (non-pageView)
      if (event.type !== "pageView") {
        const eventData: Record<string, unknown> = {
          event: toSnakeCase(event.type),
          eventId: event.eventId,
          ...event.properties,
        };

        if (event.userContext?.userId) {
          eventData.userId = event.userContext.userId;
        }
        if (event.anonymousUserId) {
          eventData.anonymousUserId = event.anonymousUserId;
        }

        const traits = event.userContext?.traits;
        if (traits && Object.keys(traits).length > 0) {
          eventData.userTraits = traits;
        }

        return {
          items: [
            {
              type: "script-template",
              templateId: GTM_EVENT_TEMPLATE_ID,
              params: { eventData } satisfies GTMEventParams,
            },
          ],
        };
      }

      const initialData: Record<string, unknown> = {};

      if (event.userContext?.userId) {
        initialData.userId = event.userContext.userId;
      }

      if (event.anonymousUserId) {
        initialData.anonymousUserId = event.anonymousUserId;
      }

      const traits = event.userContext?.traits;
      if (traits && Object.keys(traits).length > 0) {
        initialData.userTraits = traits;
      }

      const pageData: Record<string, unknown> = {
        event: "page_view",
        eventId: event.eventId,
        page_path: event.serverContext.path,
        page_title: event.properties.title ?? undefined,
        page_location: `${event.serverContext.host}${event.serverContext.path}`,
      };

      // Client-side navigation (virtual pageview) - just push event
      if (event.clientContext) {
        return {
          items: [
            {
              type: "script-template",
              templateId: GTM_PAGEVIEW_TEMPLATE_ID,
              params: { pageData } satisfies GTMPageViewParams,
            },
          ],
        };
      }

      // Initial page load - init GTM + push pageview
      return {
        items: [
          {
            type: "script-template",
            templateId: GTM_INIT_TEMPLATE_ID,
            params: { containerId, initialData } satisfies GTMInitParams,
          },
          {
            type: "script-template",
            templateId: GTM_PAGEVIEW_TEMPLATE_ID,
            params: { pageData } satisfies GTMPageViewParams,
          },
        ],
      };
    },

    updateEvent(): void {
      // GTM doesn't support event updates
    },
  };
}
