import type {
  ClientAction,
  JavascriptTemplate,
  NextlyticsBackend,
  NextlyticsBackendFactory,
  NextlyticsEvent,
  RequestContext,
} from "../types";

export type GoogleAnalyticsBackendOptions = {
  /** GA4 Measurement ID (e.g. "G-XXXXXXXXXX") */
  measurementId: string;
  /** Enable GA4 debug mode (shows events in DebugView) */
  debugMode?: boolean;
  /** API secret for Measurement Protocol (GA4 Admin → Data Streams → MP secrets) */
  apiSecret?: string;
  /**
   * Source for client_id.
   * - "gaCookie" (default): Use _ga cookie set by gtag.js, fall back to anonymousUserId
   * - "anonymousUserId": Always use Nextlytics anonymousUserId
   */
  clientIdSource?: "gaCookie" | "anonymousUserId";
  /**
   * Prefer sending client-origin events from the browser (gtag) instead of Measurement Protocol.
   * Default: true. Set to false to force Measurement Protocol when apiSecret is provided.
   */
  preferClientSideForClientEvents?: boolean;
};

type GATemplateParams = {
  measurementId: string;
  initial_config: Record<string, unknown>;
};

type GAPropertiesTemplateParams = {
  properties: Record<string, unknown>;
};

type GAEventTemplateParams = {
  eventId: string;
  eventName: string;
  eventParams: Record<string, unknown>;
  properties: Record<string, unknown>;
};

const GA_INIT_TEMPLATE = "ga-gtag";
const GA_PROPERTIES_TEMPLATE = "ga-properties";
const GA_EVENT_TEMPLATE = "ga-event";

/**
 * Parse client_id from _ga cookie value.
 * Format: GA1.1.1234567890.1706540400 -> 1234567890.1706540400
 */
function parseGaCookie(cookieValue: string): string | null {
  const match = cookieValue.match(/^GA\d+\.\d+\.(.+)$/);
  return match ? match[1] : null;
}

/** Get client_id based on config */
function getClientId(
  event: NextlyticsEvent,
  gaCookieClientId: string | null,
  source: "gaCookie" | "anonymousUserId"
): string {
  if (source === "gaCookie" && gaCookieClientId) {
    return gaCookieClientId;
  }
  // Fall back to anonymousUserId
  if (!event.anonymousUserId) {
    throw new Error("anonymousUserId is required for GA backend (no _ga cookie available)");
  }
  return event.anonymousUserId;
}

/** Convert event type to GA4 event name (snake_case) */
function toGA4EventName(type: string): string {
  if (type === "pageView") return "page_view";
  if (type === "apiCall") return "api_call";
  // Convert camelCase to snake_case
  return type
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/** Build GA4 event params from NextlyticsEvent */
function buildEventParams(event: NextlyticsEvent): Record<string, unknown> {
  const params: Record<string, unknown> = {
    // Required for engagement metrics
    engagement_time_msec: 1,
  };

  // Page context from server
  const { serverContext } = event;
  if (serverContext) {
    params.page_location = `https://${serverContext.host}${serverContext.path}`;
  }

  // Client context if available
  const { clientContext } = event;
  if (clientContext) {
    if (clientContext.referer) {
      params.page_referrer = clientContext.referer;
    }
    if (clientContext.locale) {
      params.language = clientContext.locale;
    }
    if (clientContext.screen?.width && clientContext.screen?.height) {
      params.screen_resolution = `${clientContext.screen.width}x${clientContext.screen.height}`;
    }
  }

  // Merge custom properties
  if (event.properties) {
    Object.assign(params, event.properties);
  }

  return params;
}

/** Get User-Agent from event (client or server headers) */
function getUserAgent(event: NextlyticsEvent): string | undefined {
  return event.clientContext?.userAgent ?? event.serverContext?.requestHeaders?.["user-agent"];
}

/** Get client IP for geo */
function getClientIp(event: NextlyticsEvent): string | undefined {
  return event.serverContext?.ip;
}

/** Send event to GA4 Measurement Protocol */
async function sendToMeasurementProtocol(opts: {
  measurementId: string;
  apiSecret: string;
  clientId: string;
  userId?: string;
  userProperties?: Record<string, unknown>;
  eventName: string;
  eventParams: Record<string, unknown>;
  userAgent?: string;
  clientIp?: string;
  debugMode?: boolean;
}): Promise<void> {
  const endpoint = opts.debugMode
    ? "https://www.google-analytics.com/debug/mp/collect"
    : "https://www.google-analytics.com/mp/collect";

  const url = `${endpoint}?measurement_id=${opts.measurementId}&api_secret=${opts.apiSecret}`;

  const payload: Record<string, unknown> = {
    client_id: opts.clientId,
    events: [
      {
        name: opts.eventName,
        params: opts.eventParams,
      },
    ],
  };

  if (opts.userId) {
    payload.user_id = opts.userId;
  }

  if (opts.userProperties && Object.keys(opts.userProperties).length > 0) {
    payload.user_properties = Object.fromEntries(
      Object.entries(opts.userProperties).map(([k, v]) => [k, { value: v }])
    );
  }

  // Headers for geo and device detection
  const headers: Record<string, string> = {};
  if (opts.userAgent) {
    headers["User-Agent"] = opts.userAgent;
  }
  if (opts.clientIp) {
    headers["X-Forwarded-For"] = opts.clientIp;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[GA] Measurement Protocol error: ${res.status} ${res.statusText}`, body);
    }
  } catch (err) {
    console.warn("[GA] Measurement Protocol request failed:", err);
  }
}

export function googleAnalyticsBackend(
  opts: GoogleAnalyticsBackendOptions
): NextlyticsBackendFactory {
  const { measurementId, debugMode, apiSecret, clientIdSource = "gaCookie" } = opts;

  return (ctx: RequestContext): NextlyticsBackend => {
    // Extract client_id from _ga cookie if available
    const gaCookie = ctx.cookies.get("_ga");
    const gaCookieClientId = gaCookie ? parseGaCookie(gaCookie.value) : null;
    const preferClientSideForClientEvents = opts.preferClientSideForClientEvents ?? true;

    return {
      name: "google-analytics",
      returnsClientActions: true,
      supportsUpdates: false,

      getClientSideTemplates(): Record<string, JavascriptTemplate> {
        return {
          [GA_EVENT_TEMPLATE]: {
            deps: "{{eventId}}",
            items: [
              // Update user properties for this event (if provided)
              {
                body: [
                  "gtag('set', {{json(properties)}});",
                  "gtag('event', '{{eventName}}', {{json(eventParams)}});",
                ],
              },
            ],
          },
          [GA_INIT_TEMPLATE]: {
            deps: "{{measurementId}}{{json(initial_config)}}",
            items: [
              // External gtag.js - load once
              {
                src: "https://www.googletagmanager.com/gtag/js?id={{measurementId}}",
                async: true,
              },
              // gtag definition and initialization - run once
              {
                body: [
                  "window.dataLayer = window.dataLayer || [];",
                  opts.debugMode
                    ? "function gtag(){ console.log('[gtag() call]', arguments); dataLayer.push(arguments); }"
                    : "function gtag(){dataLayer.push(arguments);}",
                  "window.gtag = gtag;",
                  "gtag('js', new Date());",
                  "gtag('config', '{{measurementId}}', {{json(initial_config)}});",
                ],
              },
            ],
          },
          [GA_PROPERTIES_TEMPLATE]: {
            deps: "{{json(properties)}}",
            items: [
              // Updates that should NOT trigger page_view (e.g., user_id, user_properties)
              {
                body: "gtag('set', {{json(properties)}});",
              },
            ],
          },
        };
      },

      async onEvent(event: NextlyticsEvent): Promise<ClientAction | undefined> {
        const clientId = getClientId(event, gaCookieClientId, clientIdSource);
        const userId = event.userContext?.userId;

        // Extract user properties (excluding PII)
        const {
          email: _email,
          name: _name,
          phone: _phone,
          ...customTraits
        } = event.userContext?.traits ?? {};
        const userProperties = Object.keys(customTraits).length > 0 ? customTraits : undefined;

        if (event.type === "pageView") {
          const initial_config: Record<string, unknown> = {
            // Rely on GA auto page_view (including SPA history changes).
            send_page_view: true,
            client_id: clientId,
          };
          if (debugMode) {
            initial_config.debug_mode = true;
          }

          const properties: Record<string, unknown> = {};
          if (userId) {
            properties.user_id = userId;
          }
          if (userProperties) {
            properties.user_properties = userProperties;
          }

          return {
            items: [
              {
                type: "script-template",
                templateId: GA_INIT_TEMPLATE,
                params: {
                  measurementId,
                  initial_config,
                } satisfies GATemplateParams,
              },
              {
                type: "script-template",
                templateId: GA_PROPERTIES_TEMPLATE,
                params: {
                  properties,
                } satisfies GAPropertiesTemplateParams,
              },
            ],
          };
        }

        const eventParams = buildEventParams(event);
        const properties: Record<string, unknown> = {};
        if (userId) {
          properties.user_id = userId;
        }
        if (userProperties) {
          properties.user_properties = userProperties;
        }

        if (event.origin === "client") {
          // Send client-origin events on the client by default (unless MP is explicitly enabled)
          if (preferClientSideForClientEvents || !apiSecret) {
            return {
              items: [
                {
                  type: "script-template",
                  templateId: GA_EVENT_TEMPLATE,
                  params: {
                    eventId: event.eventId,
                    eventName: toGA4EventName(event.type),
                    eventParams,
                    properties,
                  } satisfies GAEventTemplateParams,
                },
              ],
            };
          }

          await sendToMeasurementProtocol({
            measurementId,
            apiSecret,
            clientId,
            userId,
            userProperties,
            eventName: toGA4EventName(event.type),
            eventParams,
            userAgent: getUserAgent(event),
            clientIp: getClientIp(event),
            debugMode,
          });
          return undefined;
        }

        if (!apiSecret) {
          return undefined;
        }

        await sendToMeasurementProtocol({
          measurementId,
          apiSecret,
          clientId,
          userId,
          userProperties,
          eventName: toGA4EventName(event.type),
          eventParams,
          userAgent: getUserAgent(event),
          clientIp: getClientIp(event),
          debugMode,
        });
        return undefined;
      },

      updateEvent(): void {
        // GA doesn't support event updates
      },
    };
  };
}
