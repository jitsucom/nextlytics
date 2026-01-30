import type { NextlyticsBackendFactory, NextlyticsEvent, CookieStore } from "nextlytics";
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

export function getOrCreateSessionId(cookies: CookieStore): { sessionId: string; isNew: boolean } {
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

export const demoBackend: NextlyticsBackendFactory = ({ cookies }) => {
  const { sessionId } = getOrCreateSessionId(cookies);
  const key = sessionKey(sessionId);
  console.log("[demo-backend] Session:", sessionId);

  return {
    name: "demo",
    supportsUpdates: true,

    async onEvent(event: NextlyticsEvent): Promise<void> {
      console.log("[demo-backend] onEvent:", event.type, event.eventId);
      await redis.rpush(key, event);
      await redis.expire(key, SESSION_TTL);
    },

    async updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): Promise<void> {
      console.log("[demo-backend] updateEvent:", eventId, patch);
      const events = await redis.lrange<NextlyticsEvent>(key, 0, -1);
      for (let i = 0; i < events.length; i++) {
        if (events[i].eventId === eventId) {
          await redis.lset(key, i, { ...events[i], ...patch });
          console.log("[demo-backend] Event updated at index", i);
          return;
        }
      }
    },
  };
};
