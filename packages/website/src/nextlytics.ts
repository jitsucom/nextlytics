import { Nextlytics } from "@nextlytics/core/server";
import type { BackendConfigEntry } from "@nextlytics/core";
import { createDemoBackend } from "./lib/demo-backend";
import { auth } from "./lib/auth";

import { segmentBackend } from "@nextlytics/core/backends/segment";
import { googleTagManagerBackend } from "@nextlytics/core/backends/gtm";
import { googleAnalyticsBackend } from "@nextlytics/core/backends/ga";
import { neonBackend } from "@nextlytics/core/backends/neon";
import { postgrestBackend } from "@nextlytics/core/backends/postgrest";
import { clickhouseBackend } from "@nextlytics/core/backends/clickhouse";
import { posthogBackend } from "@nextlytics/core/backends/posthog";

function buildBackends(): BackendConfigEntry[] {
  const backends: BackendConfigEntry[] = [createDemoBackend()];

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
    backends.push(
      posthogBackend({
        apiKey: process.env.POSTHOG_API_KEY,
        host: process.env.POSTHOG_HOST,
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
  debug: true,
  backends: buildBackends(),
  isApiPath: (path) => path.startsWith("/api/"),
  excludeApiCalls: true,
});
