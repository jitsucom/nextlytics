import type { NextMiddleware, NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import { serializeServerComponentContext } from "./server-component-context";
import type {
  NextlyticsEvent,
  RequestContext,
  ServerEventContext,
  TemplatizedScriptInsertion,
  UserContext,
} from "./types";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";
import { generateId, getRequestInfo, createServerContext } from "./uitils";
import { resolveAnonymousUser } from "./anonymous-user";
import {
  handleEventPost,
  getUserContext,
  type DispatchEvent,
  type UpdateEvent,
} from "./api-handler";

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

    // Check if path should be excluded
    if (config.excludePaths?.(pathname)) {
      serializeServerComponentContext(response, {
        pageRenderId,
        pathname: request.nextUrl.pathname,
        search: request.nextUrl.search,
        scripts: [],
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

    // Serialize context to headers (templates come from config in NextlyticsServer)
    serializeServerComponentContext(response, {
      pageRenderId,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      scripts,
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
