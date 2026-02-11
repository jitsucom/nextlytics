import type { NextMiddleware, NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import {
  headers as analyticsHeaders,
  serializeServerComponentContext,
} from "./server-component-context";
import type {
  BackendWithConfig,
  ClientContext,
  DispatchResult,
  IngestPolicy,
  JavascriptTemplate,
  NextlyticsBackend,
  NextlyticsBackendFactory,
  NextlyticsEvent,
  RequestContext,
  ServerEventContext,
  TemplatizedScriptInsertion,
  UserContext,
} from "./types";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";
import { generateId, getRequestInfo, createServerContext } from "./uitils";
import { resolveAnonymousUser } from "./anonymous-user";

type DispatchEvent = (
  event: NextlyticsEvent,
  ctx: RequestContext,
  policyFilter?: IngestPolicy
) => DispatchResult;
type UpdateEvent = (
  eventId: string,
  patch: Partial<NextlyticsEvent>,
  ctx: RequestContext
) => Promise<void>;

type ResolvedBackend = {
  backend: NextlyticsBackend;
  ingestPolicy: IngestPolicy;
};

function isBackendWithConfig(entry: unknown): entry is BackendWithConfig {
  return typeof entry === "object" && entry !== null && "backend" in entry;
}

/** Resolve backend factories to actual backends with their policies */
function resolveBackends(
  config: NextlyticsConfigWithDefaults,
  ctx: RequestContext
): ResolvedBackend[] {
  const entries = config.backends || [];
  return entries
    .map((entry): ResolvedBackend | null => {
      if (isBackendWithConfig(entry)) {
        const backend = typeof entry.backend === "function" ? entry.backend(ctx) : entry.backend;
        return backend ? { backend, ingestPolicy: entry.ingestPolicy ?? "immediate" } : null;
      }
      // Plain backend or factory - default to immediate
      const backend =
        typeof entry === "function" ? (entry as NextlyticsBackendFactory)(ctx) : entry;
      return backend ? { backend, ingestPolicy: "immediate" } : null;
    })
    .filter((b): b is ResolvedBackend => b !== null);
}

/** Collect script templates from all backends */
function collectTemplates(backends: ResolvedBackend[]): Record<string, JavascriptTemplate> {
  const templates: Record<string, JavascriptTemplate> = {};
  for (const { backend } of backends) {
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
    const ctx = createRequestContext(request);

    // Resolve anonymous user ID (sets cookie if needed)
    const { anonId } = await resolveAnonymousUser({ ctx, serverContext, config, response });

    // Collect templates from backends
    const backends = resolveBackends(config, ctx);
    const templates = collectTemplates(backends);

    // Check if path should be excluded
    if (config.excludePaths?.(pathname)) {
      serializeServerComponentContext(response, {
        pageRenderId,
        pathname: request.nextUrl.pathname,
        search: request.nextUrl.search,
        scripts: [],
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
        scripts: [],
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

    // Dispatch to "immediate" backends only - "on-client-event" backends dispatch later
    const { clientActions, completion } = dispatchEvent(pageViewEvent, ctx, "immediate");
    const actions = await clientActions;

    // Extract script-template actions
    const scripts = actions.items.filter(
      (i): i is TemplatizedScriptInsertion<unknown> => i.type === "script-template"
    );

    // Defer full completion to after response
    after(() => completion);

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

type ClientInitPayload = ClientContext;

/**
 * Reconstruct proper ServerEventContext from /api/event request + client data.
 * The /api/event call has its own server context (pointing to /api/event),
 * but we need to reconstruct the original page's context using client data.
 */
function reconstructServerContext(
  apiCallContext: ServerEventContext,
  clientInit: ClientInitPayload
): ServerEventContext {
  // Parse search params from client's search string
  const searchParams: Record<string, string[]> = {};
  if (clientInit.search) {
    const params = new URLSearchParams(clientInit.search);
    params.forEach((value, key) => {
      if (!searchParams[key]) searchParams[key] = [];
      searchParams[key].push(value);
    });
  }

  return {
    ...apiCallContext,
    // Override with client-provided values
    host: clientInit.host || apiCallContext.host,
    path: clientInit.path || apiCallContext.path,
    search: Object.keys(searchParams).length > 0 ? searchParams : apiCallContext.search,
    method: "GET", // Page loads are always GET
  };
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
  const apiCallServerContext = createServerContext(request);
  const userContext = await getUserContext(config, ctx);

  if (type === "client-init") {
    const clientContext = payload as unknown as ClientInitPayload;
    const serverContext = reconstructServerContext(apiCallServerContext, clientContext);

    const { anonId: anonymousUserId } = await resolveAnonymousUser({
      ctx,
      serverContext,
      config,
    });

    // Dispatch to "on-client-event" backends (they didn't get the pageView in middleware)
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
    const { clientActions, completion } = dispatchEvent(event, ctx, "on-client-event");
    const actions = await clientActions;
    after(() => completion);

    // Also update "immediate" backends with client context
    after(() => updateEvent(pageRenderId, { clientContext, userContext, anonymousUserId }, ctx));

    // Filter to script-template only
    const scripts = actions.items.filter((i) => i.type === "script-template");
    return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
  } else if (type === "soft-navigation") {
    // Soft navigation in App Router - layout didn't re-render, so we need to
    // dispatch pageView and return scripts that would have been in the initial render
    const clientContext = payload as unknown as ClientInitPayload;
    const serverContext = reconstructServerContext(apiCallServerContext, clientContext);

    const { anonId: anonymousUserId } = await resolveAnonymousUser({
      ctx,
      serverContext,
      config,
    });

    const event: NextlyticsEvent = {
      eventId: generateId(), // New event ID for the soft navigation
      parentEventId: pageRenderId,
      type: "pageView",
      collectedAt: new Date().toISOString(),
      anonymousUserId,
      serverContext,
      clientContext,
      userContext,
      properties: {},
    };

    // Dispatch to "immediate" backends (same as middleware would do)
    const { clientActions, completion } = dispatchEvent(event, ctx, "immediate");
    const actions = await clientActions;
    after(() => completion);

    // Filter to script-template only
    const scripts = actions.items.filter((i) => i.type === "script-template");
    return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
  } else if (type === "client-event") {
    const clientContext = (payload.clientContext as ClientContext) || undefined;
    const serverContext = clientContext
      ? reconstructServerContext(apiCallServerContext, clientContext)
      : apiCallServerContext;

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
    // Client events go to all backends
    const { clientActions, completion } = dispatchEvent(event, ctx);
    const actions = await clientActions;
    after(() => completion);
    // Filter to script-template only
    const scripts = actions.items.filter((i) => i.type === "script-template");
    return Response.json({ ok: true, scripts: scripts.length > 0 ? scripts : undefined });
  }

  return Response.json({ ok: true });
}
