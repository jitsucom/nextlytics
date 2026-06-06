import type { NextMiddleware, NextRequest } from "next/server";
import { NextResponse, after } from "next/server";
import {
  LAST_PAGE_RENDER_ID_COOKIE,
  headerNames,
  serializeServerComponentContext,
} from "./server-component-context";
import type {
  NextlyticsEvent,
  RequestContext,
  ServerEventContext,
  TemplatizedScriptInsertion,
  UserContext,
} from "./types";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";
import { generateId, getRequestInfo, createServerContext, getNextVersion } from "./uitils";
import { resolveAnonymousUser } from "./anonymous-user";
import {
  handleEventPost,
  getUserContext,
  getEventProps,
  type CollectTemplates,
  type DispatchEvent,
  type UpdateEvent,
} from "./api-handler";

function createRequestContext(request: NextRequest): RequestContext {
  return {
    headers: request.headers,
    cookies: request.cookies,
    path: request.nextUrl.pathname,
  };
}

export function createNextlyticsMiddleware(
  config: NextlyticsConfigWithDefaults,
  dispatchEvent: DispatchEvent,
  updateEvent: UpdateEvent,
  collectTemplates: CollectTemplates
): NextMiddleware {
  const { eventEndpoint } = config;

  return async (request) => {
    const pathname = request.nextUrl.pathname;
    const reqInfo = getRequestInfo(request);
    const middlewareDebug = config.debug || process.env.NEXTLYTICS_MIDDLEWARE_DEBUG === "true";

    if (middlewareDebug) {
      const headers = request.headers;
      const debugHeaders: Record<string, string> = {};
      headers.forEach((value, key) => {
        debugHeaders[key] = value;
      });

      console.log("[Nextlytics][middleware]", {
        url: request.url,
        pathname,
        search: request.nextUrl.search,
        method: request.method,
        nextVersion: getNextVersion(),
        destination: request.destination,
        referrer: request.referrer,
        mode: request.mode,
        cache: request.cache,
        redirect: request.redirect,
        integrity: request.integrity,
        isPrefetch: reqInfo.isPrefetch,
        isRsc: reqInfo.isRsc,
        isDocumentRequest: reqInfo.isDocumentRequest,
        isBrowserSubrequest: reqInfo.isBrowserSubrequest,
        isPageNavigation: reqInfo.isPageNavigation,
        isStaticFile: reqInfo.isStaticFile,
        isNextjsInternal: reqInfo.isNextjsInternal,
        headers: debugHeaders,
      });
    }

    // Handle event endpoint directly in middleware
    if (pathname === eventEndpoint) {
      if (request.method === "POST") {
        return handleEventPost(request, config, dispatchEvent, updateEvent, collectTemplates);
      }
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Skip internal paths, prefetch, and static files
    if (reqInfo.isNextjsInternal || reqInfo.isPrefetch || reqInfo.isStaticFile) {
      const response = NextResponse.next();
      response.headers.set(headerNames.active, "1");
      return response;
    }

    // Skip browser-initiated sub-requests (RSC soft-navigations, XHR, fetch(),
    // subresources): the browser sets Sec-Fetch-Dest to something other than
    // "document" for these. A single soft navigation fires RSC fetches that
    // carry no reliable RSC header in Next 15.5+, so we can't single them out by
    // an "rsc" marker — but they DO carry Sec-Fetch-Dest, and they're tracked
    // client-side via /api/event, so counting them here would duplicate the
    // pageView. Everything else is tracked: hard document navigations, and
    // requests from non-browser clients (agents, curl, bots, server-to-server)
    // which omit Sec-Fetch-* — that's how route handlers serving .md/.txt/JSON
    // get counted. API paths are exempt so they still reach the apiCall handling
    // below (subject to excludeApiCalls).
    if (reqInfo.isBrowserSubrequest && !config.isApiPath(pathname)) {
      const response = NextResponse.next();
      response.headers.set(headerNames.active, "1");
      return response;
    }

    // On non-API routes, only reads (GET/HEAD) and document navigations are
    // pageViews. A non-read, non-navigation request to a non-API route — e.g. a
    // webhook or programmatic POST/PUT to a Route Handler — is not a page view,
    // so skip it. (A classic server-rendered form POST is a document navigation,
    // so it's kept.) API paths flow through for any method → apiCall.
    const isReadMethod = request.method === "GET" || request.method === "HEAD";
    if (!isReadMethod && !reqInfo.isDocumentRequest && !config.isApiPath(pathname)) {
      const response = NextResponse.next();
      response.headers.set(headerNames.active, "1");
      return response;
    }

    const pageRenderId = generateId();
    const serverContext = createServerContext(request);
    const response = NextResponse.next();
    const ctx = createRequestContext(request);
    response.cookies.set(LAST_PAGE_RENDER_ID_COOKIE, pageRenderId, { path: "/" });

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
    const extraProps = await getEventProps(config, ctx, userContext);
    const pageViewEvent = createPageViewEvent(
      pageRenderId,
      serverContext,
      isApiPath,
      userContext,
      anonId,
      extraProps
    );

    // Dispatch to "on-request" backends only - "on-page-load" backends dispatch later
    const { clientActions, completion } = dispatchEvent(pageViewEvent, ctx, "on-request");
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
  anonymousUserId?: string,
  extraProps?: Record<string, unknown>
): NextlyticsEvent {
  const eventType = isApiPath ? "apiCall" : "pageView";
  return {
    origin: "server",
    collectedAt: serverContext.collectedAt.toISOString(),
    eventId: pageRenderId,
    type: eventType,
    anonymousUserId,
    serverContext,
    userContext,
    properties: { ...extraProps },
  };
}
