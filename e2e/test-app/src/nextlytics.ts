import { Nextlytics } from "@nextlytics/core/server";
import type { BackendConfigEntry } from "@nextlytics/core";
import { postgrestBackend } from "@nextlytics/core/backends/postgrest";
import { auth } from "./auth";

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
];

export const { middleware, handlers, analytics } = Nextlytics({
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
