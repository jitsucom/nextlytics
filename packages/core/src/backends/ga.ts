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
};

type GATemplateParams = {
  measurementId: string;
  config: Record<string, unknown>;
};

const GA_TEMPLATE_ID = "ga-gtag";

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

    return {
      name: "google-analytics",
      returnsClientActions: true,
      supportsUpdates: false,

      getClientSideTemplates(): Record<string, JavascriptTemplate> {
        return {
          [GA_TEMPLATE_ID]: {
            items: [
              {
                async: "true",
                src: "https://www.googletagmanager.com/gtag/js?id={{measurementId}}",
                singleton: true,
              },
              {
                body: [
                  "window.dataLayer = window.dataLayer || [];",
                  "function gtag(){dataLayer.push(arguments);}",
                  "gtag('js', new Date());",
                  "gtag('config', '{{measurementId}}', {{json(config)}});",
                  "gtag('event', 'page_view');",
                ].join("\n"),
              },
            ],
          },
        };
      },

      async onEvent(event: NextlyticsEvent): Promise<void | ClientAction> {
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

        // For pageView: return client-side scripts
        if (event.type === "pageView") {
          const config: Record<string, unknown> = {
            send_page_view: false,
            client_id: clientId,
          };

          if (debugMode) {
            config.debug_mode = true;
          }
          if (userId) {
            config.user_id = userId;
          }
          if (userProperties) {
            config.user_properties = userProperties;
          }

          return {
            items: [
              {
                type: "script-template",
                templateId: GA_TEMPLATE_ID,
                params: {
                  measurementId,
                  config,
                } satisfies GATemplateParams,
              },
            ],
          };
        }

        // For other events: send via Measurement Protocol (if configured)
        if (apiSecret) {
          await sendToMeasurementProtocol({
            measurementId,
            apiSecret,
            clientId,
            userId,
            userProperties,
            eventName: toGA4EventName(event.type),
            eventParams: buildEventParams(event),
            userAgent: getUserAgent(event),
            clientIp: getClientIp(event),
            debugMode,
          });
        }
      },

      updateEvent(): void {
        // GA doesn't support event updates
      },
    };
  };
}
