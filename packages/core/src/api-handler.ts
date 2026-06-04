import type { NextRequest } from "next/server";
import { after } from "next/server";
import {
  LAST_PAGE_RENDER_ID_COOKIE,
  headerNames as analyticsHeaders,
} from "./server-component-context";
import type {
  ClientContext,
  ClientRequest,
  DispatchResult,
  JavascriptTemplate,
  PageViewDelivery,
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
  policyFilter?: PageViewDelivery | "client-actions"
) => DispatchResult;

export type UpdateEvent = (
  eventId: string,
  patch: Partial<NextlyticsEvent>,
  ctx: RequestContext
) => Promise<void>;

/** Collect the client-side templates from the configured backends. */
export type CollectTemplates = (ctx: RequestContext) => Record<string, JavascriptTemplate>;

type HandlerContext = {
  pageRenderId: string;
  isSoftNavigation: boolean;
  ctx: RequestContext;
  apiCallServerContext: ServerEventContext;
  userContext: UserContext | undefined;
  config: NextlyticsConfigWithDefaults;
  dispatchEvent: DispatchEvent;
  updateEvent: UpdateEvent;
  collectTemplates: CollectTemplates;
  /** Template ids the client already holds (from the known-templates header). */
  knownTemplateIds: Set<string>;
};

/**
 * Collect the templates for this request and drop the ones the client already
 * has. App Router clients already hold the full set (from the ctx prop), so they
 * get nothing back; a Pages Router client receives each template once. Returns
 * undefined when there is nothing new, to keep it out of the JSON response.
 */
function newTemplatesFor(hctx: HandlerContext): Record<string, JavascriptTemplate> | undefined {
  const all = hctx.collectTemplates(hctx.ctx);
  const missing: Record<string, JavascriptTemplate> = {};
  for (const [id, template] of Object.entries(all)) {
    if (!hctx.knownTemplateIds.has(id)) missing[id] = template;
  }
  return Object.keys(missing).length > 0 ? missing : undefined;
}

function createRequestContext(request: NextRequest): RequestContext {
  return {
    headers: request.headers,
    cookies: request.cookies,
    path: request.nextUrl.pathname,
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

export async function getEventProps(
  config: NextlyticsConfigWithDefaults,
  ctx: RequestContext,
  userContext?: UserContext
): Promise<Record<string, unknown> | undefined> {
  if (!config.callbacks.getProps) return undefined;
  try {
    return (await config.callbacks.getProps({ ...ctx, user: userContext })) || undefined;
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
  request: Extract<ClientRequest, { type: "page-view" }>,
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

  // Resolve getProps using the real page path (not /api/event)
  const pageCtx: RequestContext = { ...ctx, path: serverContext.path };
  const propsFromCallback = await getEventProps(config, pageCtx, userContext);

  // Soft navigation keeps the same pageRenderId but needs a fresh eventId
  // so client-side scripts depending on eventId can re-run per navigation.
  const isSoftNavigation = hctx.isSoftNavigation;
  const eventId = isSoftNavigation ? generateId() : pageRenderId;
  const event: NextlyticsEvent = {
    origin: "client",
    eventId,
    parentEventId: isSoftNavigation ? pageRenderId : undefined,
    type: "pageView",
    collectedAt: new Date().toISOString(),
    anonymousUserId,
    serverContext,
    clientContext,
    userContext,
    properties: { ...propsFromCallback },
  };

  if (isSoftNavigation) {
    // Soft nav: middleware skipped RSC requests, dispatch to all backends here
    const { clientActions, completion } = dispatchEvent(event, ctx);
    const actions = await clientActions;
    after(() => completion);

    return Response.json({
      ok: true,
      items: filterScripts(actions),
      templates: newTemplatesFor(hctx),
    });
  }

  // Hard nav: dispatch to on-page-load + returnsClientActions backends,
  // update on-request backends with client context
  const { completion } = dispatchEvent(event, ctx, "client-actions");
  after(() => completion);
  after(() => updateEvent(pageRenderId, { clientContext, userContext, anonymousUserId }, ctx));

  return Response.json({ ok: true, templates: newTemplatesFor(hctx) });
}

async function handleClientEvent(
  request: Extract<ClientRequest, { type: "custom-event" }>,
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

  // Resolve getProps using the real page path (not /api/event)
  const pageCtx: RequestContext = { ...ctx, path: serverContext.path };
  const propsFromCallback = await getEventProps(config, pageCtx, userContext);

  const event: NextlyticsEvent = {
    origin: "client",
    eventId: generateId(),
    parentEventId: pageRenderId,
    type: name,
    collectedAt: collectedAt || new Date().toISOString(),
    anonymousUserId,
    serverContext,
    clientContext,
    userContext,
    properties: { ...propsFromCallback, ...props },
  };

  const { clientActions, completion } = dispatchEvent(event, ctx);
  const actions = await clientActions;
  after(() => completion);

  return Response.json({
    ok: true,
    items: filterScripts(actions),
    templates: newTemplatesFor(hctx),
  });
}

export async function handleEventPost(
  request: NextRequest,
  config: NextlyticsConfigWithDefaults,
  dispatchEvent: DispatchEvent,
  updateEvent: UpdateEvent,
  collectTemplates: CollectTemplates
): Promise<Response> {
  const softNavHeader = request.headers.get(analyticsHeaders.isSoftNavigation);
  const isSoftNavigation = softNavHeader === "1";
  const pageRenderIdHeader = request.headers.get(analyticsHeaders.pageRenderId);
  if (!pageRenderIdHeader) {
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

  const knownTemplatesHeader = request.headers.get(analyticsHeaders.knownTemplates);
  const knownTemplateIds = new Set(
    knownTemplatesHeader
      ? knownTemplatesHeader
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : []
  );

  const cookiePageRenderId = request.cookies.get(LAST_PAGE_RENDER_ID_COOKIE)?.value;
  const pageRenderId = isSoftNavigation ? (cookiePageRenderId ?? generateId()) : pageRenderIdHeader;
  if (isSoftNavigation && !cookiePageRenderId && config.debug) {
    console.warn(
      "[Nextlytics] Missing last-page-render-id cookie on soft navigation; using a new id."
    );
  }

  const hctx: HandlerContext = {
    pageRenderId,
    isSoftNavigation,
    ctx,
    apiCallServerContext,
    userContext,
    config,
    dispatchEvent,
    updateEvent,
    collectTemplates,
    knownTemplateIds,
  };

  const bodyType = body.type;
  switch (bodyType) {
    case "page-view":
      return handleClientInit(body, hctx);
    case "custom-event":
      return handleClientEvent(body, hctx);
    default:
      return Response.json({ ok: false, error: `Unknown body type ${bodyType}` }, { status: 400 });
  }
}
