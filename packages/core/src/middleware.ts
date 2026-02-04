import type { NextMiddleware, NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import {
  headers as analyticsHeaders,
  serializeServerComponentContext,
} from "./server-component-context";
import type {
  ClientContext,
  DispatchResult,
  JavascriptTemplate,
  NextlyticsBackend,
  NextlyticsEvent,
  RequestContext,
  ServerEventContext,
  TemplatizedScriptInsertion,
  UserContext,
} from "./types";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";
import { generateId, getRequestInfo, createServerContext } from "./uitils";
import { resolveAnonymousUser } from "./anonymous-user";

type DispatchEvent = (event: NextlyticsEvent, ctx: RequestContext) => DispatchResult;
type UpdateEvent = (
  eventId: string,
  patch: Partial<NextlyticsEvent>,
  ctx: RequestContext
) => Promise<void>;

/** Resolve backend factories to actual backends */
function resolveBackends(
  config: NextlyticsConfigWithDefaults,
  ctx: RequestContext
): NextlyticsBackend[] {
  const backends = config.backends || [];
  return backends
    .map((backend) => (typeof backend === "function" ? backend(ctx) : backend))
    .filter((b): b is NextlyticsBackend => b !== null);
}

/** Collect script templates from all backends */
function collectTemplates(backends: NextlyticsBackend[]): Record<string, JavascriptTemplate> {
  const templates: Record<string, JavascriptTemplate> = {};
  for (const backend of backends) {
    if (backend.getClientSideTemplates) {
      Object.assign(templates, backend.getClientSideTemplates());
    }
  }
  return templates;
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

    const pageRenderId = generateId();
    const serverContext = createServerContext(request);
    const response = NextResponse.next();

    // Resolve anonymous user ID (sets cookie if needed)
    const { anonId } = await resolveAnonymousUser(request, response, serverContext, config);

    // Collect templates from backends
    const ctx = createRequestContext(request);
    const backends = resolveBackends(config, ctx);
    const templates = collectTemplates(backends);

    // Prepare scripts (will be populated if pageView is dispatched)
    let scripts: TemplatizedScriptInsertion<unknown>[] = [];

    // Only dispatch page view on server if pageViewMode is "server" (default)
    if (config.pageViewMode !== "client-init") {
      // Check if path should be excluded
      if (config.excludePaths?.(pathname)) {
        serializeServerComponentContext(response, {
          pageRenderId,
          pathname: request.nextUrl.pathname,
          search: request.nextUrl.search,
          scripts,
          templates,
        });
        return response;
      }

      // Check if API calls should be excluded
      const isApiPath = config.isApiPath(pathname);
      if (isApiPath && config.excludeApiCalls) {
        serializeServerComponentContext(response, {
          pageRenderId,
          pathname: request.nextUrl.pathname,
          search: request.nextUrl.search,
          scripts,
          templates,
        });
        return response;
      }

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

      // Extract script-template actions
      scripts = actions.items.filter(
        (i): i is TemplatizedScriptInsertion<unknown> => i.type === "script-template"
      );

      // Defer full completion to after response
      after(() => completion);
    }

    // Serialize context to headers
    serializeServerComponentContext(response, {
      pageRenderId,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      scripts,
      templates,
    });

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
    after(() => completion);
    // Filter to script-template only
    const scripts = actions.items.filter((i) => i.type === "script-template");
    return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
  }

  return Response.json({ ok: true });
}
