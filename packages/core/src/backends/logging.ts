import type { NextlyticsBackend, NextlyticsEvent } from "../types";

export function loggingBackend(): NextlyticsBackend {
  return {
    name: "logging",
    supportsUpdates: true,

    async onEvent(event: NextlyticsEvent): Promise<void> {
      const { type, eventId, serverContext, ...rest } = event;
      const method = serverContext?.method || "";
      const path = serverContext?.path || "";

      const route = method && path ? `${method} ${path}` : "";
      console.log(`[Nextlytics Log] ${type}${route ? ` ${route}` : ""} (${eventId})`);
      console.log(JSON.stringify({ serverContext, ...rest }, null, 2));
    },

    updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): void {
      console.log(`[Nextlytics Log] Update ${eventId}`);
      console.log(JSON.stringify(patch, null, 2));
    },
  };
}
