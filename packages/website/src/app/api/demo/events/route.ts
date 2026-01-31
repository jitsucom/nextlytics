import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionEvents } from "@/lib/demo-backend";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  console.log("[demo/events] GET sessionId:", sessionId);

  if (!sessionId) {
    return Response.json({ events: [], sessionId: null });
  }

  const events = await getSessionEvents(sessionId);
  console.log("[demo/events] Events count:", events.length);
  return Response.json({ events, sessionId });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
