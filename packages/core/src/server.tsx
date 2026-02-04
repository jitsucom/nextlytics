import type { ReactNode } from "react";
import { headers, cookies } from "next/headers";
import { removeSensitiveHeaders } from "./headers";
import {
  headers as analyticsHeaders,
  restoreServerComponentContext,
} from "./server-component-context";
import { NextlyticsClient } from "./client";
import type {
  ClientAction,
  DispatchResult,
  NextlyticsBackend,
  NextlyticsConfig,
  NextlyticsEvent,
  NextlyticsPlugin,
  NextlyticsResult,
  RequestContext,
  ServerEventContext,
} from "./types";
import { createHandlers } from "./handlers";
import { logConfigWarnings, validateConfig, withDefaults } from "./config-helpers";
import { createNextlyticsMiddleware } from "./middleware";
import { generateId } from "./uitils";

function resolveBackends(config: NextlyticsConfig, ctx: RequestContext): NextlyticsBackend[] {
  const backends = config.backends || [];
  return backends
    .map((backend) => {
      if (typeof backend === "function") {
        return backend(ctx);
      }
      return backend;
    })
    .filter((b): b is NextlyticsBackend => b !== null);
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
  };
}

export async function NextlyticsServer({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const ctx = restoreServerComponentContext(headersList);

  if (!ctx) {
    console.warn(
      "[Nextlytics] nextlyticsMiddleware should be added in order for NextlyticsServer to work"
    );
    return <>{children}</>;
  }

  return (
    <NextlyticsClient requestId={ctx.pageRenderId} scripts={ctx.scripts} templates={ctx.templates}>
      {children}
    </NextlyticsClient>
  );
}

export function Nextlytics(userConfig: NextlyticsConfig): NextlyticsResult {
  const config = withDefaults(userConfig);

  // Validate config and log warnings
  const validationResult = validateConfig(config);
  logConfigWarnings(validationResult);

  const dispatchEventInternal = (event: NextlyticsEvent, ctx: RequestContext): DispatchResult => {
    const plugins = resolvePlugins(config, ctx);
    const backends = resolveBackends(config, ctx);

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
      return backends.map((backend) => {
        const start = Date.now();
        const promise = backend
          .onEvent(event)
          .then((result) => ({ ok: true as const, ms: Date.now() - start, result }))
          .catch((err) => {
            console.warn(`[Nextlytics] Backend "${backend.name}" failed on onEvent:`, err);
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
          const nameWidth = Math.max(...results.map((r) => r.backend.name.length));
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
    const backends = resolveBackends(config, ctx).filter((backend) => backend.supportsUpdates);
    const results = await Promise.all(
      backends.map(async (backend) => {
        const start = Date.now();
        try {
          await backend.updateEvent(eventId, patch);
          return { backend, ok: true as const, ms: Date.now() - start };
        } catch (err) {
          console.warn(`[Nextlytics] Backend "${backend.name}" failed on updateEvent:`, err);
          return { backend, ok: false as const, ms: Date.now() - start };
        }
      })
    );
    if (config.debug && backends.length > 0) {
      const nameWidth = Math.max(...backends.map((b) => b.name.length));
      console.log(`[Nextlytics] updateEvent ${eventId} (${backends.length} backends)`);
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

  const middleware = createNextlyticsMiddleware(config, dispatchEventInternal, updateEventInternal);
  const handlers = createHandlers(config, dispatchEventInternal, updateEventInternal);

  const analytics = async () => {
    const headersList = await headers();
    const cookieStore = await cookies();
    const pageRenderId = headersList.get(analyticsHeaders.pageRenderId);

    const serverContext = createServerContextFromHeaders(headersList);
    const ctx: RequestContext = { headers: headersList, cookies: cookieStore };

    // Get user context if callback is configured
    let userContext: NextlyticsEvent["userContext"];
    if (config.callbacks.getUser) {
      try {
        userContext = (await config.callbacks.getUser(ctx)) || undefined;
      } catch {
        // Ignore errors from getUser
      }
    }

    return {
      sendEvent: async (
        eventName: string,
        opts?: { props?: Record<string, unknown> }
      ): Promise<{ ok: boolean }> => {
        if (!pageRenderId) {
          console.error("[Nextlytics] analytics() requires nextlyticsMiddleware");
          return { ok: false };
        }

        const event: NextlyticsEvent = {
          eventId: generateId(),
          parentEventId: pageRenderId,
          type: eventName,
          collectedAt: new Date().toISOString(),
          serverContext,
          userContext,
          properties: opts?.props || {},
        };
        await dispatchEventInternal(event, ctx);

        return { ok: true };
      },
    };
  };

  return { middleware, handlers, analytics, dispatchEvent, updateEvent };
}

function createServerContextFromHeaders(
  headersList: Awaited<ReturnType<typeof headers>>
): ServerEventContext {
  const rawHeaders: Record<string, string> = {};
  headersList.forEach((value, key) => {
    rawHeaders[key] = value;
  });
  const requestHeaders = removeSensitiveHeaders(rawHeaders);

  const pathname = headersList.get(analyticsHeaders.pathname) || "";
  const search = headersList.get(analyticsHeaders.search) || "";
  const searchParams: Record<string, string[]> = {};

  if (search) {
    const params = new URLSearchParams(search);
    params.forEach((value, key) => {
      if (!searchParams[key]) {
        searchParams[key] = [];
      }
      searchParams[key].push(value);
    });
  }

  return {
    collectedAt: new Date(),
    host: headersList.get("host") || "",
    method: "GET",
    path: pathname,
    search: searchParams,
    ip: headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    requestHeaders,
    responseHeaders: {},
  };
}
