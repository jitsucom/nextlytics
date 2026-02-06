import type { NextRequest } from "next/server";
import { headers as analyticsHeaders } from "./server-component-context";
import type {
  DispatchResult,
  NextlyticsEvent,
  ClientContext,
  RequestContext,
  UserContext,
} from "./types";
import { createServerContext, generateId } from "./uitils";
import { resolveAnonymousUser } from "./anonymous-user";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";

type AppRouteHandlers = Record<"GET" | "POST", (req: NextRequest) => Promise<Response>>;

function createRequestContext(request: NextRequest): RequestContext {
  return {
    headers: request.headers,
    cookies: request.cookies,
  };
}

async function getUserContext(
  config: NextlyticsConfigWithDefaults,
  ctx: RequestContext
): Promise<UserContext | undefined> {
  if (!config.callbacks.getUser) return undefined;
  // Errors in getUser callback are intentionally not caught here.
  // If your auth logic throws, it's likely a configuration issue that should surface.
  return (await config.callbacks.getUser(ctx)) || undefined;
}

export function createHandlers(
  config: NextlyticsConfigWithDefaults,
  dispatchEvent: (event: NextlyticsEvent, ctx: RequestContext) => DispatchResult,
  updateEvent: (
    eventId: string,
    patch: Partial<NextlyticsEvent>,
    ctx: RequestContext
  ) => Promise<void>
): AppRouteHandlers {
  return {
    GET: async (): Promise<Response> => {
      return Response.json({ status: "ok" });
    },

    POST: async (req: NextRequest): Promise<Response> => {
      const pageRenderId = req.headers.get(analyticsHeaders.pageRenderId);
      if (!pageRenderId) {
        return Response.json({ error: "Missing page render ID" }, { status: 400 });
      }

      let body: { type: string; payload: Record<string, unknown> };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const { type, payload } = body;
      const ctx = createRequestContext(req);

      if (type === "client-init") {
        const clientContext = payload as unknown as ClientContext;
        const serverContext = createServerContext(req);
        if (clientContext?.path) {
          serverContext.path = clientContext.path;
        }

        const userContext = await getUserContext(config, ctx);
        const { anonId: anonymousUserId } = await resolveAnonymousUser({
          ctx,
          serverContext,
          config,
        });

        if (config.pageViewMode === "client-init") {
          const event: NextlyticsEvent = {
            eventId: pageRenderId,
            type: "pageView",
            collectedAt: new Date().toISOString(),
            anonymousUserId,
            serverContext,
            clientContext,
            userContext,
            properties: {},
          };
          const { clientActions, completion } = dispatchEvent(event, ctx);
          const actions = await clientActions;
          // Don't await completion - let it finish in background
          completion.catch((err) => console.warn("[Nextlytics] Dispatch completion error:", err));
          // Filter to script-template only
          const scripts = actions.items.filter((i) => i.type === "script-template");
          return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
        } else {
          await updateEvent(pageRenderId, { clientContext, userContext, anonymousUserId }, ctx);
          return Response.json({ ok: true });
        }
      } else if (type === "client-event") {
        const clientContext = (payload.clientContext as ClientContext) || undefined;
        const serverContext = createServerContext(req);
        if (clientContext?.path) {
          serverContext.path = clientContext.path;
        }

        const userContext = await getUserContext(config, ctx);
        const { anonId: anonymousUserId } = await resolveAnonymousUser({
          ctx,
          serverContext,
          config,
        });

        const event: NextlyticsEvent = {
          eventId: generateId(),
          parentEventId: pageRenderId,
          type: (payload.name as string) || type,
          collectedAt: (payload.collectedAt as string) || new Date().toISOString(),
          anonymousUserId,
          serverContext,
          clientContext,
          userContext,
          properties: (payload.props as Record<string, unknown>) || {},
        };
        const { clientActions, completion } = dispatchEvent(event, ctx);
        const actions = await clientActions;
        // Don't await completion - let it finish in background
        completion.catch((err) => console.warn("[Nextlytics] Dispatch completion error:", err));
        // Filter to script-template only
        const scripts = actions.items.filter((i) => i.type === "script-template");
        return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
      }

      return Response.json({ ok: true });
    },
  };
}
