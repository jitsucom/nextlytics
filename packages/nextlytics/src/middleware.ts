import type { NextMiddleware, NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import { headers as analyticsHeaders } from "./headers";
import type {
  ClientAction,
  ClientContext,
  DispatchResult,
  NextlyticsEvent,
  RequestContext,
  ServerEventContext,
  UserContext,
} from "./types";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";
import { getRequestInfo, createServerContext } from "./uitils";
import { resolveAnonymousUser } from "./anonymous-user";

type DispatchEvent = (event: NextlyticsEvent, ctx?: RequestContext) => DispatchResult;
type UpdateEvent = (
  eventId: string,
  patch: Partial<NextlyticsEvent>,
  ctx?: RequestContext
) => Promise<void>;

/** Serialize script-template actions to compact header format: templateId=params;... */
function serializeScriptActions(actions: ClientAction): string | null {
  const scripts = actions.items.filter((item) => item.type === "script-template");
  if (scripts.length === 0) return null;
  return scripts.map((s) => `${s.templateId}=${JSON.stringify(s.params)}`).join(";");
}

function createRequestContext(request: NextRequest): RequestContext {
  return {
    headers: request.headers,
    cookies: request.cookies,
  };
}

export function createNextlyticsMiddleware(
  config: NextlyticsConfigWithDefaults,
  dispatchEvent: DispatchEvent,
  updateEvent: UpdateEvent
): NextMiddleware {
  const { eventEndpoint } = config;

  return async (request) => {
    const pathname = request.nextUrl.pathname;
    const reqInfo = getRequestInfo(request);

    // Handle event endpoint directly in middleware
    if (pathname === eventEndpoint) {
      if (request.method === "POST") {
        return handleEventPost(request, config, dispatchEvent, updateEvent);
      }
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Skip internal paths, prefetch, and static files
    if (reqInfo.isNextjsInternal || reqInfo.isPrefetch || reqInfo.isStaticFile) {
      return NextResponse.next();
    }

    const pageRenderId = crypto.randomUUID();
    const serverContext = createServerContext(request);
    const response = NextResponse.next();

    // Resolve anonymous user ID (sets cookie if needed)
    const { anonId } = await resolveAnonymousUser(request, response, serverContext, config);

    response.headers.set(analyticsHeaders.pathname, request.nextUrl.pathname);
    response.headers.set(analyticsHeaders.search, request.nextUrl.search);
    response.headers.set(analyticsHeaders.pageRenderId, pageRenderId);

    // Only dispatch page view on server if pageViewMode is "server" (default)
    if (config.pageViewMode !== "client-init") {
      // Check if path should be excluded
      if (config.excludePaths?.(pathname)) {
        return response;
      }

      // Check if API calls should be excluded
      const isApiPath = config.isApiPath(pathname);
      if (isApiPath && config.excludeApiCalls) {
        return response;
      }

      const ctx = createRequestContext(request);
      const userContext = await getUserContext(config, ctx);
      const pageViewEvent = createPageViewEvent(
        pageRenderId,
        serverContext,
        isApiPath,
        userContext,
        anonId
      );

      // Two-phase dispatch: get clientActions fast, defer completion
      const { clientActions, completion } = dispatchEvent(pageViewEvent, ctx);
      const actions = await clientActions;

      // Set scripts header in compact format: templateId=params;...
      const scriptsHeader = serializeScriptActions(actions);
      if (scriptsHeader) {
        response.headers.set(analyticsHeaders.scripts, scriptsHeader);
      }

      // Defer full completion to after response
      after(() => completion);
    }

    return response;
  };
}

function createPageViewEvent(
  pageRenderId: string,
  serverContext: ServerEventContext,
  isApiPath: boolean,
  userContext?: UserContext,
  anonymousUserId?: string
): NextlyticsEvent {
  const eventType = isApiPath ? "apiCall" : "pageView";
  return {
    collectedAt: serverContext.collectedAt.toISOString(),
    eventId: pageRenderId,
    type: eventType,
    anonymousUserId,
    serverContext,
    userContext,
    properties: {},
  };
}

async function getUserContext(
  config: NextlyticsConfigWithDefaults,
  ctx: RequestContext
): Promise<UserContext | undefined> {
  if (!config.callbacks.getUser) return undefined;
  try {
    return (await config.callbacks.getUser(ctx)) || undefined;
  } catch {
    return undefined;
  }
}

async function handleEventPost(
  request: NextRequest,
  config: NextlyticsConfigWithDefaults,
  dispatchEvent: DispatchEvent,
  updateEvent: UpdateEvent
): Promise<Response> {
  const pageRenderId = request.headers.get(analyticsHeaders.pageRenderId);
  if (!pageRenderId) {
    return Response.json({ error: "Missing page render ID" }, { status: 400 });
  }

  let body: { type: string; payload: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, payload } = body;

  const ctx = createRequestContext(request);
  const serverContext = createServerContext(request);
  const userContext = await getUserContext(config, ctx);
  const { anonId: anonymousUserId } = await resolveAnonymousUser(
    request,
    null,
    serverContext,
    config
  );

  if (type === "client-init") {
    const clientContext = payload as unknown as ClientContext;
    if (clientContext?.path) {
      serverContext.path = clientContext.path;
    }

    if (config.pageViewMode === "client-init") {
      // pageView wasn't dispatched in middleware, create it now
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
      after(() => completion);
      // Filter to script-template only
      const scripts = actions.items.filter((i) => i.type === "script-template");
      return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
    } else {
      // pageView was already dispatched, update with client context
      after(() => updateEvent(pageRenderId, { clientContext, userContext, anonymousUserId }, ctx));
      return Response.json({ ok: true });
    }
  } else if (type === "client-event") {
    const clientContext = (payload.clientContext as ClientContext) || undefined;

    // Override server path with client path if available (for SPA navigation)
    if (clientContext?.path) {
      serverContext.path = clientContext.path;
    }

    const event: NextlyticsEvent = {
      eventId: crypto.randomUUID(),
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
    after(() => completion);
    // Filter to script-template only
    const scripts = actions.items.filter((i) => i.type === "script-template");
    return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
  }

  return Response.json({ ok: true });
}
