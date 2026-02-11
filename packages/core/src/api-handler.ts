import type { NextRequest } from "next/server";
import { after } from "next/server";
import { headers as analyticsHeaders } from "./server-component-context";
import type {
  ClientContext,
  ClientRequest,
  DispatchResult,
  IngestPolicy,
  NextlyticsEvent,
  RequestContext,
  ServerEventContext,
  UserContext,
} from "./types";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";
import { generateId, createServerContext } from "./uitils";
import { resolveAnonymousUser } from "./anonymous-user";

export type DispatchEvent = (
  event: NextlyticsEvent,
  ctx: RequestContext,
  policyFilter?: IngestPolicy
) => DispatchResult;

export type UpdateEvent = (
  eventId: string,
  patch: Partial<NextlyticsEvent>,
  ctx: RequestContext
) => Promise<void>;

type HandlerContext = {
  pageRenderId: string;
  ctx: RequestContext;
  apiCallServerContext: ServerEventContext;
  userContext: UserContext | undefined;
  config: NextlyticsConfigWithDefaults;
  dispatchEvent: DispatchEvent;
  updateEvent: UpdateEvent;
};

function createRequestContext(request: NextRequest): RequestContext {
  return {
    headers: request.headers,
    cookies: request.cookies,
  };
}

export async function getUserContext(
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

/**
 * Reconstruct proper ServerEventContext from /api/event request + client data.
 * The /api/event call has its own server context (pointing to /api/event),
 * but we need to reconstruct the original page's context using client data.
 */
function reconstructServerContext(
  apiCallContext: ServerEventContext,
  clientContext: ClientContext
): ServerEventContext {
  const searchParams: Record<string, string[]> = {};
  if (clientContext.search) {
    const params = new URLSearchParams(clientContext.search);
    params.forEach((value, key) => {
      if (!searchParams[key]) searchParams[key] = [];
      searchParams[key].push(value);
    });
  }

  return {
    ...apiCallContext,
    host: clientContext.host || apiCallContext.host,
    path: clientContext.path || apiCallContext.path,
    search: Object.keys(searchParams).length > 0 ? searchParams : apiCallContext.search,
    method: "GET",
  };
}

function filterScripts(actions: { items: { type: string }[] }) {
  const scripts = actions.items.filter((i) => i.type === "script-template");
  return scripts.length > 0 ? scripts : undefined;
}

async function handleClientInit(
  request: Extract<ClientRequest, { type: "client-init" }>,
  hctx: HandlerContext
): Promise<Response> {
  const {
    pageRenderId,
    ctx,
    apiCallServerContext,
    userContext,
    config,
    dispatchEvent,
    updateEvent,
  } = hctx;
  const { clientContext } = request;
  const serverContext = reconstructServerContext(apiCallServerContext, clientContext);

  const { anonId: anonymousUserId } = await resolveAnonymousUser({
    ctx,
    serverContext,
    config,
  });

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

  return Response.json({ ok: true, scripts: filterScripts(actions) });
}

async function handleSoftNavigation(
  request: Extract<ClientRequest, { type: "soft-navigation" }>,
  hctx: HandlerContext
): Promise<Response> {
  const { pageRenderId, ctx, apiCallServerContext, userContext, config, dispatchEvent } = hctx;
  const { clientContext } = request;
  const serverContext = reconstructServerContext(apiCallServerContext, clientContext);

  const { anonId: anonymousUserId } = await resolveAnonymousUser({
    ctx,
    serverContext,
    config,
  });

  const event: NextlyticsEvent = {
    eventId: generateId(),
    parentEventId: pageRenderId,
    type: "pageView",
    collectedAt: new Date().toISOString(),
    anonymousUserId,
    serverContext,
    clientContext,
    userContext,
    properties: {},
  };

  const { clientActions, completion } = dispatchEvent(event, ctx, "immediate");
  const actions = await clientActions;
  after(() => completion);

  return Response.json({ ok: true, scripts: filterScripts(actions) });
}

async function handleClientEvent(
  request: Extract<ClientRequest, { type: "client-event" }>,
  hctx: HandlerContext
): Promise<Response> {
  const { pageRenderId, ctx, apiCallServerContext, userContext, config, dispatchEvent } = hctx;
  const { clientContext, name, props, collectedAt } = request;

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
    type: name,
    collectedAt: collectedAt || new Date().toISOString(),
    anonymousUserId,
    serverContext,
    clientContext,
    userContext,
    properties: props || {},
  };

  const { clientActions, completion } = dispatchEvent(event, ctx);
  const actions = await clientActions;
  after(() => completion);

  return Response.json({ ok: true, scripts: filterScripts(actions) });
}

export async function handleEventPost(
  request: NextRequest,
  config: NextlyticsConfigWithDefaults,
  dispatchEvent: DispatchEvent,
  updateEvent: UpdateEvent
): Promise<Response> {
  const pageRenderId = request.headers.get(analyticsHeaders.pageRenderId);
  if (!pageRenderId) {
    return Response.json({ error: "Missing page render ID" }, { status: 400 });
  }

  let body: ClientRequest;
  try {
    body = (await request.json()) as ClientRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ctx = createRequestContext(request);
  const apiCallServerContext = createServerContext(request);
  const userContext = await getUserContext(config, ctx);

  const hctx: HandlerContext = {
    pageRenderId,
    ctx,
    apiCallServerContext,
    userContext,
    config,
    dispatchEvent,
    updateEvent,
  };

  switch (body.type) {
    case "client-init":
      return handleClientInit(body, hctx);
    case "soft-navigation":
      return handleSoftNavigation(body, hctx);
    case "client-event":
      return handleClientEvent(body, hctx);
    default:
      return Response.json({ ok: true });
  }
}
