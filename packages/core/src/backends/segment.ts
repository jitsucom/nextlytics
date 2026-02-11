/**
 * Segment backend for Nextlytics
 *
 * Sends events to Segment's HTTP Tracking API. Also works with Segment-compatible
 * destinations like Jitsu.
 *
 * ## Segment Usage
 *
 * ```typescript
 * import { segmentBackend } from "@nextlytics/core/backends/segment"
 *
 * const analytics = Nextlytics({
 *   backends: [
 *     segmentBackend({
 *       writeKey: process.env.SEGMENT_WRITE_KEY!,
 *     })
 *   ]
 * })
 * ```
 *
 * ## Jitsu Usage
 *
 * ```typescript
 * segmentBackend({
 *   writeKey: process.env.JITSU_WRITE_KEY!,
 *   host: "https://ingest.g.jitsu.com",
 * })
 * ```
 */
import type { ClientAction, NextlyticsBackend, NextlyticsEvent } from "../types";

export type SegmentBackendConfig = {
  /** Segment write key */
  writeKey: string;
  /** API host (default: "https://api.segment.io") */
  host?: string;
};

export function segmentBackend(config: SegmentBackendConfig): NextlyticsBackend {
  const host = (config.host ?? "https://api.segment.io").replace(/\/$/, "");

  async function send(batch: Record<string, unknown>[]) {
    const res = await fetch(`${host}/v1/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Write-Key": config.writeKey,
      },
      body: JSON.stringify({ batch }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Segment error ${res.status}: ${text}`);
    }
  }

  function buildUrl(event: NextlyticsEvent): string {
    // Prefer client-provided URL if available
    if (event.clientContext?.url) return event.clientContext.url;

    const { host, path, search } = event.serverContext;
    const protocol = host.includes("localhost") || host.match(/^[\d.:]+$/) ? "http" : "https";
    const searchStr = Object.entries(search)
      .flatMap(([k, vals]) => vals.map((v) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`))
      .join("&");
    return `${protocol}://${host}${path}${searchStr ? `?${searchStr}` : ""}`;
  }

  function getSearchString(event: NextlyticsEvent): string {
    // Prefer client-provided search if available
    if (event.clientContext?.search) return event.clientContext.search;

    return Object.entries(event.serverContext.search)
      .flatMap(([k, vals]) => vals.map((v) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`))
      .join("&");
  }

  function getReferringDomain(referer?: string): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).hostname;
    } catch {
      return undefined;
    }
  }

  function buildContext(event: NextlyticsEvent) {
    const ctx: Record<string, unknown> = {
      ip: event.serverContext.ip,
    };

    if (event.userContext?.traits) {
      ctx.traits = event.userContext.traits;
    }

    const cc = event.clientContext;
    const sc = event.serverContext;

    ctx.page = {
      path: cc?.path ?? sc.path,
      referrer: cc?.referer,
      referring_domain: getReferringDomain(cc?.referer),
      host: cc?.host ?? sc.host,
      search: getSearchString(event),
      title: cc?.title,
      url: buildUrl(event),
    };

    if (cc) {
      ctx.userAgent = cc.userAgent;
      ctx.locale = cc.locale;
      if (cc.screen) {
        ctx.screen = {
          width: cc.screen.width,
          height: cc.screen.height,
          innerWidth: cc.screen.innerWidth,
          innerHeight: cc.screen.innerHeight,
          density: cc.screen.density,
        };
      }
    }

    return ctx;
  }

  function buildProperties(event: NextlyticsEvent) {
    const cc = event.clientContext;
    const sc = event.serverContext;

    return {
      parentEventId: event.parentEventId,
      path: cc?.path ?? sc.path,
      url: buildUrl(event),
      search: getSearchString(event),
      hash: cc?.hash,
      title: cc?.title,
      referrer: cc?.referer,
      width: cc?.screen?.innerWidth,
      height: cc?.screen?.innerHeight,
      ...event.properties,
    };
  }

  return {
    name: "segment",
    supportsUpdates: false,

    async onEvent(event: NextlyticsEvent): Promise<ClientAction | undefined> {
      const context = buildContext(event);
      const properties = buildProperties(event);

      const basePayload = {
        messageId: event.eventId,
        anonymousId: event.anonymousUserId,
        userId: event.userContext?.userId,
        timestamp: event.collectedAt,
        context,
        properties,
      };

      if (event.type === "pageView") {
        await send([{ type: "page", name: event.serverContext.path, ...basePayload }]);
      } else {
        await send([{ type: "track", event: event.type, ...basePayload }]);
      }
      return undefined;
    },

    updateEvent() {
      // Segment doesn't support updating events
    },
  };
}
