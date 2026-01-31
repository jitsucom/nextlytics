import type { NextlyticsBackend, NextlyticsEvent } from "../types";

export type PosthogBackendOptions = {
  /** PostHog project API key */
  apiKey: string;
  /** PostHog host (default: "https://app.posthog.com") */
  host?: string;
};

export function posthogBackend(opts: PosthogBackendOptions): NextlyticsBackend {
  const host = (opts.host ?? "https://app.posthog.com").replace(/\/$/, "");
  const apiKey = opts.apiKey;

  return {
    name: "posthog",
    supportsUpdates: false,

    async onEvent(event: NextlyticsEvent): Promise<void> {
      const {
        type,
        eventId,
        parentEventId,
        collectedAt,
        userContext,
        clientContext,
        serverContext,
        properties,
        anonymousUserId,
      } = event;

      // Build PostHog properties
      const posthogProps: Record<string, unknown> = {
        ...properties,
        nextlytics_event_id: eventId,
      };

      // Add parent event reference
      if (parentEventId) {
        posthogProps.nextlytics_parent_event_id = parentEventId;
      }

      // Add collection timestamp
      posthogProps.nextlytics_collected_at = collectedAt;

      // Add server context
      posthogProps.$current_url = `${serverContext.host}${serverContext.path}`;
      posthogProps.$pathname = serverContext.path;
      posthogProps.$host = serverContext.host;
      posthogProps.$ip = serverContext.ip;
      posthogProps.http_method = serverContext.method;
      posthogProps.server_collected_at = serverContext.collectedAt;

      // Add query params if present
      if (serverContext.search && Object.keys(serverContext.search).length > 0) {
        posthogProps.query_params = serverContext.search;
      }

      // Add request/response headers (filtered by nextlytics)
      if (serverContext.requestHeaders && Object.keys(serverContext.requestHeaders).length > 0) {
        posthogProps.request_headers = serverContext.requestHeaders;
      }
      if (serverContext.responseHeaders && Object.keys(serverContext.responseHeaders).length > 0) {
        posthogProps.response_headers = serverContext.responseHeaders;
      }

      // Add referrer (client context first, then server request headers)
      const referer = clientContext?.referer ?? serverContext.requestHeaders?.["referer"];
      if (referer) {
        posthogProps.$referrer = referer;
      }

      // Add user agent (client context first, then server request headers)
      const userAgent = clientContext?.userAgent ?? serverContext.requestHeaders?.["user-agent"];
      if (userAgent) {
        posthogProps.$user_agent = userAgent;
      }

      // Add client context if available
      if (clientContext) {
        posthogProps.client_collected_at = clientContext.collectedAt;

        if (clientContext.path) {
          posthogProps.client_path = clientContext.path;
        }
        if (clientContext.locale) {
          posthogProps.$locale = clientContext.locale;
        }
        if (clientContext.screen) {
          const { screen } = clientContext;
          if (screen.width) posthogProps.$screen_width = screen.width;
          if (screen.height) posthogProps.$screen_height = screen.height;
          if (screen.innerWidth) posthogProps.$viewport_width = screen.innerWidth;
          if (screen.innerHeight) posthogProps.$viewport_height = screen.innerHeight;
          if (screen.density) posthogProps.$device_pixel_ratio = screen.density;
        }
      }

      // Build the capture payload
      const distinctId = userContext?.userId ?? anonymousUserId ?? "anonymous";

      const payload: Record<string, unknown> = {
        api_key: apiKey,
        event: type,
        distinct_id: distinctId,
        properties: posthogProps,
        timestamp: collectedAt,
      };

      // Add user properties via $set if user is identified
      if (userContext?.userId && userContext.traits) {
        payload.$set = userContext.traits;
      }

      const res = await fetch(`${host}/capture/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PostHog error ${res.status}: ${text}`);
      }
    },

    updateEvent(): void {
      // PostHog doesn't support event updates
    },
  };
}
