import { Nextlytics } from "@nextlytics/core/server";
import { postgrestBackend } from "@nextlytics/core/backends/postgrest";
import { auth } from "./auth";

const backends = [
  postgrestBackend({
    url: process.env.POSTGREST_URL || "http://localhost:3001",
    tableName: "analytics",
  }),
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
