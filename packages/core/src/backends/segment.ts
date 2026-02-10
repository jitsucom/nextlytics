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
import type { NextlyticsBackend, NextlyticsEvent } from "../types";

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

  function buildContext(event: NextlyticsEvent) {
    const ctx: Record<string, unknown> = {
      ip: event.serverContext.ip,
    };

    if (event.userContext?.traits) {
      ctx.traits = event.userContext.traits;
    }

    if (event.clientContext) {
      ctx.userAgent = event.clientContext.userAgent;
      ctx.locale = event.clientContext.locale;
      ctx.page = {
        path: event.clientContext.path,
        referrer: event.clientContext.referer,
      };
      if (event.clientContext.screen) {
        ctx.screen = {
          width: event.clientContext.screen.width,
          height: event.clientContext.screen.height,
          innerWidth: event.clientContext.screen.innerWidth,
          innerHeight: event.clientContext.screen.innerHeight,
          density: event.clientContext.screen.density,
        };
      }
    }

    return ctx;
  }

  function buildProperties(event: NextlyticsEvent) {
    return {
      parentEventId: event.parentEventId,
      path: event.serverContext.path,
      host: event.serverContext.host,
      method: event.serverContext.method,
      search: event.serverContext.search,
      ...event.properties,
    };
  }

  return {
    name: "segment",
    supportsUpdates: false,

    async onEvent(event: NextlyticsEvent): Promise<void> {
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
    },

    updateEvent() {
      // Segment doesn't support updating events
    },
  };
}
