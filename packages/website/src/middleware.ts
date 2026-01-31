import { NextFetchEvent, NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { middleware as nextlyticsMiddleware } from "./nextlytics";
import { getOrCreateSessionId, setSessionCookie } from "./lib/demo-backend";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = await nextlyticsMiddleware(request, event);

  if (response instanceof NextResponse) {
    const { sessionId, isNew } = getOrCreateSessionId(request.cookies);
    if (isNew) {
      setSessionCookie(response, sessionId);
    }
  }

  return response;
}
