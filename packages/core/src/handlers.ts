import type { NextRequest } from "next/server";

type AppRouteHandlers = Record<"GET" | "POST", (req: NextRequest) => Promise<Response>>;

/**
 * Route handlers for /api/event (deprecated - middleware handles this now)
 *
 * Kept for backward compatibility. If you have mounted these handlers at /api/event,
 * the middleware will intercept the request first, so these won't be called.
 */
export function createHandlers(): AppRouteHandlers {
  return {
    GET: async (): Promise<Response> => {
      return Response.json({ status: "ok" });
    },

    POST: async (): Promise<Response> => {
      // Middleware should handle this - if we get here, middleware isn't configured
      return Response.json(
        { error: "Middleware not configured. Events are handled by nextlyticsMiddleware." },
        { status: 500 }
      );
    },
  };
}
