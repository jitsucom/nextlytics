import type { ReactNode } from "react";
import type { NextRequest } from "next/server";
import type { NextApiRequest } from "next";
import type { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { headers, cookies } from "next/headers";
import { removeSensitiveHeaders } from "./headers";
import {
  headerNames,
  restoreServerComponentContext,
  LAST_PAGE_RENDER_ID_COOKIE,
} from "./server-component-context";
import { resolveAnonymousUser } from "./anonymous-user";
import { NextlyticsClient } from "./client";
import type {
  BackendWithConfig,
  ClientAction,
  DispatchResult,
  PageViewDelivery,
  JavascriptTemplate,
  NextlyticsBackend,
  NextlyticsBackendFactory,
  NextlyticsConfig,
  NextlyticsEvent,
  NextlyticsPlugin,
  NextlyticsResult,
  RequestContext,
  ServerEventContext,
} from "./types";
import { logConfigWarnings, validateConfig, withDefaults } from "./config-helpers";
import { createNextlyticsMiddleware } from "./middleware";
import { generateId } from "./uitils";
import { getEventProps } from "./api-handler";

type ResolvedBackend = {
  backend: NextlyticsBackend;
  pageViewDelivery: PageViewDelivery;
};

/**
 * Filter for resolveBackends():
 * - PageViewDelivery value: return only backends with that delivery mode
 * - "client-actions": return on-page-load backends + any backend with returnsClientActions
 */
type PolicyFilter = PageViewDelivery | "client-actions";

function isBackendWithConfig(entry: unknown): entry is BackendWithConfig {
  return typeof entry === "object" && entry !== null && "backend" in entry;
}

/**
 * Resolve backend config entries into concrete backends with their delivery mode.
 * Optionally filter by PolicyFilter — see PolicyFilter type for semantics.
 */
function resolveBackends(
  config: NextlyticsConfig,
  ctx: RequestContext,
  policyFilter?: PolicyFilter
): ResolvedBackend[] {
  const entries = config.backends || [];
  return entries
    .map((entry): ResolvedBackend | null => {
      if (isBackendWithConfig(entry)) {
        const backend = typeof entry.backend === "function" ? entry.backend(ctx) : entry.backend;
        return backend
          ? { backend, pageViewDelivery: entry.pageViewDelivery ?? "on-request" }
          : null;
      }
      // Plain backend or factory - default to on-request
      const backend =
        typeof entry === "function" ? (entry as NextlyticsBackendFactory)(ctx) : entry;
      return backend ? { backend, pageViewDelivery: "on-request" } : null;
    })
    .filter((b): b is ResolvedBackend => b !== null)
    .filter((b) => {
      if (!policyFilter) return true;
      if (policyFilter === "client-actions") {
        return b.pageViewDelivery === "on-page-load" || b.backend.returnsClientActions;
      }
      return b.pageViewDelivery === policyFilter;
    });
}

function resolvePlugins(config: NextlyticsConfig, ctx: RequestContext): NextlyticsPlugin[] {
  const plugins = config.plugins || [];
  return plugins
    .map((plugin) => {
      if (typeof plugin === "function") {
        if (!ctx) {
          return null;
        }
        return plugin(ctx);
      }
      return plugin;
    })
    .filter((p): p is NextlyticsPlugin => p !== null);
}

/** Merge client actions from multiple backends */
function mergeClientActions(actions: (ClientAction | void | undefined)[]): ClientAction {
  const items: ClientAction["items"] = [];
  for (const action of actions) {
    if (action?.items) {
      items.push(...action.items);
    }
  }
  return { items };
}

export async function createRequestContext(): Promise<RequestContext> {
  const [_cookies, _headers] = await Promise.all([cookies(), headers()]);
  return {
    cookies: _cookies,
    headers: _headers,
    path: _headers.get("x-nl-pathname") || "",
  };
}

/** Collect templates from all backends */
function collectTemplates(
  config: NextlyticsConfig,
  ctx: RequestContext
): Record<string, JavascriptTemplate> {
  const templates: Record<string, JavascriptTemplate> = {};
  const backends = resolveBackends(config, ctx);
  for (const { backend } of backends) {
    if (backend.getClientSideTemplates) {
      Object.assign(templates, backend.getClientSideTemplates());
    }
  }
  return templates;
}

export function Nextlytics(userConfig: NextlyticsConfig): NextlyticsResult {
  const config = withDefaults(userConfig);

  // Validate config and log warnings
  const validationResult = validateConfig(config);
  logConfigWarnings(validationResult);

  const dispatchEventInternal = (
    event: NextlyticsEvent,
    ctx: RequestContext,
    policyFilter?: PolicyFilter
  ): DispatchResult => {
    const plugins = resolvePlugins(config, ctx);
    const resolved = resolveBackends(config, ctx, policyFilter);

    // Run plugins first (they can mutate the event)
    const pluginsDone = (async () => {
      for (const plugin of plugins) {
        try {
          await plugin.onDispatch(event);
        } catch (err) {
          console.warn("[Nextlytics] Plugin failed on onDispatch:", err);
        }
      }
    })();

    // After plugins, start all backends and store their promises
    const backendResults = pluginsDone.then(() => {
      return resolved.map(({ backend }) => {
        const start = Date.now();
        const promise = backend
          .onEvent(event)
          .then((result) => ({ ok: true as const, ms: Date.now() - start, result }))
          .catch((err) => {
            console.error(`[Nextlytics] Backend "${backend.name}" failed on onEvent:`, err);
            if (err instanceof Error && err.stack) console.error(err.stack);
            return { ok: false as const, ms: Date.now() - start, result: undefined };
          });
        return { backend, promise };
      });
    });

    // clientActions: wait only for backends with returnsClientActions (heuristic - may return nothing)
    const clientActions = backendResults.then(async (results) => {
      const actionResults = results.filter((r) => r.backend.returnsClientActions);
      const actions = await Promise.all(actionResults.map((r) => r.promise));
      return mergeClientActions(actions.map((a) => a.result));
    });

    // completion: wait for all backends
    const completion = backendResults
      .then(async (results) => {
        const settled = await Promise.all(results.map((r) => r.promise));
        if (config.debug) {
          const nameWidth = Math.max(...results.map((r) => r.backend.name.length), 1);
          console.log(
            `[Nextlytics] dispatchEvent ${event.type} ${event.eventId} (${results.length} backends)`
          );
          results.forEach((r, i) => {
            const s = settled[i];
            const status = s.ok ? "ok" : "fail";
            console.log(`  ${r.backend.name.padEnd(nameWidth)}  ${status.padEnd(4)}  ${s.ms}ms`);
          });
        }
      })
      .then(() => {});

    return { clientActions, completion };
  };

  const updateEventInternal = async (
    eventId: string,
    patch: Partial<NextlyticsEvent>,
    ctx: RequestContext
  ): Promise<void> => {
    // Only update "on-request" backends that support updates
    const resolved = resolveBackends(config, ctx, "on-request").filter(
      ({ backend }) => backend.supportsUpdates
    );
    const results = await Promise.all(
      resolved.map(async ({ backend }) => {
        const start = Date.now();
        try {
          await backend.updateEvent(eventId, patch);
          return { backend, ok: true as const, ms: Date.now() - start };
        } catch (err) {
          console.error(`[Nextlytics] Backend "${backend.name}" failed on updateEvent:`, err);
          if (err instanceof Error && err.stack) console.error(err.stack);
          return { backend, ok: false as const, ms: Date.now() - start };
        }
      })
    );
    if (config.debug && resolved.length > 0) {
      const nameWidth = Math.max(...resolved.map(({ backend }) => backend.name.length));
      console.log(`[Nextlytics] updateEvent ${eventId} (${resolved.length} backends)`);
      results.forEach((r) => {
        const status = r.ok ? "ok" : "fail";
        console.log(`  ${r.backend.name.padEnd(nameWidth)}  ${status.padEnd(4)}  ${r.ms}ms`);
      });
    }
  };

  // Public API - creates context from Next.js headers/cookies
  const dispatchEvent = async (event: NextlyticsEvent) => {
    const ctx = await createRequestContext();
    return dispatchEventInternal(event, ctx);
  };
  const updateEvent = async (eventId: string, patch: Partial<NextlyticsEvent>) => {
    const ctx = await createRequestContext();
    return updateEventInternal(eventId, patch, ctx);
  };

  const middleware = createNextlyticsMiddleware(
    config,
    dispatchEventInternal,
    updateEventInternal,
    (ctx) => collectTemplates(config, ctx)
  );

  /** Server component that provides analytics context to the app */
  async function Server({ children }: { children: ReactNode }) {
    const headersList = await headers();
    const ctx = restoreServerComponentContext(headersList);

    if (!ctx) {
      // x-nl-page-render-id absent → check if middleware is at least active
      if (!headersList.get(headerNames.active)) {
        console.warn(
          "[Nextlytics] nextlyticsMiddleware should be added in order for Server to work"
        );
      }
      return <>{children}</>;
    }

    // Get templates directly from backends (config is captured in closure)
    const requestCtx = await createRequestContext();
    const templates = collectTemplates(config, requestCtx);

    return (
      <NextlyticsClient ctx={{ requestId: ctx.pageRenderId, scripts: ctx.scripts, templates }}>
        {children}
      </NextlyticsClient>
    );
  }

  const analytics = async (req?: NextRequest | NextApiRequest) => {
    // App Router (no `req`) reads context from `next/headers`. Pages Router API
    // routes pass `req` (NextApiRequest) since `next/headers` throws there; App
    // Router Route Handlers may pass `req` (NextRequest) too.
    const source = req ? normalizeRequest(req) : await normalizeFromNextHeaders();

    // Link the event to the page render that triggered it, when there is one.
    // Standalone routes (e.g. email pixels) have no page render — parentEventId
    // is omitted in that case rather than failing.
    const pageRenderId =
      source.headers.get(headerNames.pageRenderId) ||
      source.cookies.get(LAST_PAGE_RENDER_ID_COOKIE)?.value ||
      undefined;

    const serverContext = buildServerContext(source);
    const ctx: RequestContext = {
      headers: source.headers,
      cookies: source.cookies,
      path: source.path,
    };

    // Resolve anonymous user ID
    const { anonId: anonymousUserId } = await resolveAnonymousUser({ ctx, serverContext, config });

    // Get user context if callback is configured
    let userContext: NextlyticsEvent["userContext"];
    if (config.callbacks.getUser) {
      try {
        userContext = (await config.callbacks.getUser(ctx)) || undefined;
      } catch {
        // Ignore errors from getUser
      }
    }

    const propsFromCallback = await getEventProps(config, ctx, userContext);

    return {
      sendEvent: async (
        eventName: string,
        opts?: { props?: Record<string, unknown> }
      ): Promise<{ ok: boolean }> => {
        // In the App Router no-arg path a missing pageRenderId means middleware
        // never ran — keep that as a hard error. With an explicit `req` the
        // caller built the context themselves, so a missing render id is fine.
        if (!pageRenderId && !req) {
          console.error("[Nextlytics] analytics() requires nextlyticsMiddleware");
          return { ok: false };
        }

        const event: NextlyticsEvent = {
          origin: "server",
          eventId: generateId(),
          ...(pageRenderId ? { parentEventId: pageRenderId } : {}),
          type: eventName,
          collectedAt: new Date().toISOString(),
          anonymousUserId,
          serverContext,
          userContext,
          properties: { ...propsFromCallback, ...opts?.props },
        };
        // Await full delivery, not just dispatch kickoff. Unlike the middleware
        // page-view path (which defers `completion` with `after()`), an explicit
        // sendEvent has no response to ride on — in a serverless function the
        // process can freeze right after this returns, dropping in-flight backend
        // writes. Awaiting `completion` makes `await sendEvent()` mean "delivered".
        const { completion } = dispatchEventInternal(event, ctx);
        await completion;

        return { ok: true };
      },
    };
  };

  return {
    middleware,
    analytics,
    dispatchEvent,
    updateEvent,
    NextlyticsServer: Server,
  };
}

/** Request data `analytics()` needs, normalized across its three sources:
 * App Router (`next/headers`), App Router Route Handlers (NextRequest), and
 * Pages Router API routes (NextApiRequest). */
type NormalizedRequest = {
  headers: Headers;
  cookies: Pick<RequestCookies, "get" | "getAll" | "has">;
  path: string;
  search: Record<string, string[]>;
  method: string;
};

function searchToRecord(params: URLSearchParams): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  params.forEach((value, key) => {
    (out[key] ??= []).push(value);
  });
  return out;
}

/** NextRequest exposes a Web `Headers` (has `.get`); NextApiRequest exposes a
 * plain `IncomingHttpHeaders` object (no `.get`). */
function isNextApiRequest(req: NextRequest | NextApiRequest): req is NextApiRequest {
  return typeof (req.headers as { get?: unknown })?.get !== "function";
}

async function normalizeFromNextHeaders(): Promise<NormalizedRequest> {
  const [_cookies, _headers] = await Promise.all([cookies(), headers()]);
  return {
    headers: _headers,
    cookies: _cookies,
    path: _headers.get(headerNames.pathname) || "",
    search: searchToRecord(new URLSearchParams(_headers.get(headerNames.search) || "")),
    method: "GET",
  };
}

function normalizeRequest(req: NextRequest | NextApiRequest): NormalizedRequest {
  if (!isNextApiRequest(req)) {
    return {
      headers: req.headers,
      cookies: req.cookies,
      path: req.nextUrl.pathname,
      search: searchToRecord(req.nextUrl.searchParams),
      method: req.method,
    };
  }

  // Pages Router API route (req/res).
  const headersList = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headersList.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  const cookieMap = req.cookies || {};
  const cookieStore: Pick<RequestCookies, "get" | "getAll" | "has"> = {
    get: (name: string) => {
      const value = cookieMap[name];
      return value === undefined ? undefined : { name, value };
    },
    getAll: () => Object.entries(cookieMap).map(([name, value]) => ({ name, value })),
    has: (name: string) => name in cookieMap,
  } as Pick<RequestCookies, "get" | "getAll" | "has">;

  const url = new URL(req.url || "/", `http://${headersList.get("host") || "localhost"}`);
  return {
    headers: headersList,
    cookies: cookieStore,
    path: url.pathname,
    search: searchToRecord(url.searchParams),
    method: req.method || "GET",
  };
}

function buildServerContext(source: NormalizedRequest): ServerEventContext {
  const rawHeaders: Record<string, string> = {};
  source.headers.forEach((value, key) => {
    rawHeaders[key] = value;
  });

  return {
    collectedAt: new Date(),
    host: source.headers.get("host") || "",
    method: source.method,
    path: source.path,
    search: source.search,
    ip: source.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    requestHeaders: removeSensitiveHeaders(rawHeaders),
    responseHeaders: {},
  };
}
