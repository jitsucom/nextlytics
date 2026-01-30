import { Nextlytics } from "nextlytics/server";
import type { NextlyticsBackend, NextlyticsBackendFactory } from "nextlytics";
import { demoBackend } from "./lib/demo-backend";
import { auth } from "./lib/auth";

import { segmentBackend } from "nextlytics/backends/segment";
import { googleTagManagerBackend } from "nextlytics/backends/gtm";
import { googleAnalyticsBackend } from "nextlytics/backends/ga";
import { neonBackend } from "nextlytics/backends/neon";
import { postgrestBackend } from "nextlytics/backends/postgrest";
import { clickhouseBackend } from "nextlytics/backends/clickhouse";
import { posthogBackend } from "nextlytics/backends/posthog";

// Edge-compatible PostHog adapter using HTTP API directly
function createPosthogHttpAdapter(apiKey: string, host: string) {
  const endpoint = `${host.replace(/\/$/, "")}/capture/`;
  let currentDistinctId: string | undefined;

  return {
    identify(distinctId: string, properties?: Record<string, unknown>) {
      currentDistinctId = distinctId;
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          event: "$identify",
          distinct_id: distinctId,
          properties: { $set: properties },
        }),
      }).catch(() => {});
    },
    capture(event: string, properties?: Record<string, unknown>) {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          event,
          distinct_id: currentDistinctId ?? "anonymous",
          properties,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    },
  };
}

function buildBackends(): (NextlyticsBackend | NextlyticsBackendFactory)[] {
  const backends: (NextlyticsBackend | NextlyticsBackendFactory)[] = [demoBackend];

  if (process.env.SEGMENT_WRITE_KEY) {
    backends.push(
      segmentBackend({
        writeKey: process.env.SEGMENT_WRITE_KEY,
        host: process.env.SEGMENT_HOST,
      })
    );
  }

  if (process.env.GTM_CONTAINER_ID) {
    backends.push(googleTagManagerBackend({ containerId: process.env.GTM_CONTAINER_ID }));
  }

  if (process.env.GA_MEASUREMENT_ID) {
    backends.push(
      googleAnalyticsBackend({
        measurementId: process.env.GA_MEASUREMENT_ID,
        apiSecret: process.env.GA_API_SECRET,
        debugMode: process.env.GA_DEBUG_MODE === "true",
      })
    );
  }

  if (process.env.NEON_DATABASE_URL) {
    backends.push(neonBackend({ databaseUrl: process.env.NEON_DATABASE_URL }));
  }

  if (process.env.POSTGREST_URL) {
    backends.push(
      postgrestBackend({
        url: process.env.POSTGREST_URL,
        apiKey: process.env.POSTGREST_API_KEY,
      })
    );
  }

  if (process.env.CLICKHOUSE_URL) {
    backends.push(
      clickhouseBackend({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USERNAME,
        password: process.env.CLICKHOUSE_PASSWORD,
        database: process.env.CLICKHOUSE_DATABASE,
      })
    );
  }

  if (process.env.POSTHOG_API_KEY) {
    const host = process.env.POSTHOG_HOST || "https://app.posthog.com";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backends.push(
      posthogBackend({
        posthog: createPosthogHttpAdapter(process.env.POSTHOG_API_KEY, host) as any,
      })
    );
  }

  return backends;
}

export const { handlers, middleware, analytics } = Nextlytics({
  callbacks: {
    async getUser(_ctx) {
      const session = await auth();
      if (!session?.user) return null as never;

      const provider = session.user.provider ?? "unknown";
      const id = session.user.id ?? session.user.email ?? "unknown";

      return {
        userId: `${provider}/${id}`,
        traits: {
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
        },
      };
    },
  },
  anonymousUsers: {},
  backends: buildBackends(),
  isApiPath: (path) => path.startsWith("/api/"),
  excludeApiCalls: true,
});
