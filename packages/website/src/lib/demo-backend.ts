import type {
  ClientAction,
  NextlyticsBackendFactory,
  NextlyticsEvent,
  RequestContext,
} from "@nextlytics/core";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const SESSION_COOKIE = "nextlytics_demo_session";
const SESSION_TTL = 30 * 60; // 30 minutes

const redis = Redis.fromEnv();

function sessionKey(sessionId: string): string {
  return `nextlytics:demo:${sessionId}`;
}

export async function getSessionEvents(sessionId: string): Promise<NextlyticsEvent[]> {
  const data = await redis.lrange<NextlyticsEvent>(sessionKey(sessionId), 0, -1);
  return data || [];
}

export function getOrCreateSessionId(cookies: RequestContext["cookies"]): {
  sessionId: string;
  isNew: boolean;
} {
  const existingSession = cookies.get(SESSION_COOKIE)?.value;
  if (existingSession) {
    return { sessionId: existingSession, isNew: false };
  }
  return { sessionId: crypto.randomUUID(), isNew: true };
}

export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_TTL,
  });
}

export type DemoBackendConfig = {
  debug?: boolean;
};

export function createDemoBackend(config: DemoBackendConfig = {}): NextlyticsBackendFactory {
  const log = config.debug
    ? (...args: unknown[]) => console.log("[demo-backend]", ...args)
    : () => {};

  return ({ cookies }) => {
    const { sessionId } = getOrCreateSessionId(cookies);
    const key = sessionKey(sessionId);
    log("Session:", sessionId);

    return {
      name: "demo",
      supportsUpdates: true,

      async onEvent(event: NextlyticsEvent): Promise<ClientAction | undefined> {
        if (
          !event.serverContext.path.startsWith("/demo") &&
          !event.serverContext.path.startsWith("/api/demo")
        ) {
          return undefined;
        }
        log("onEvent:", event.type, event.eventId);
        await redis.rpush(key, event);
        await redis.expire(key, SESSION_TTL);
        return undefined;
      },

      async updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): Promise<void> {
        log("updateEvent:", eventId, patch);
        const events = await redis.lrange<NextlyticsEvent>(key, 0, -1);
        for (let i = 0; i < events.length; i++) {
          if (events[i].eventId === eventId) {
            await redis.lset(key, i, { ...events[i], ...patch });
            log("Event updated at index", i);
            return;
          }
        }
      },
    };
  };
}

/** @deprecated Use createDemoBackend({ debug: true }) instead */
export const demoBackend: NextlyticsBackendFactory = createDemoBackend({ debug: true });
