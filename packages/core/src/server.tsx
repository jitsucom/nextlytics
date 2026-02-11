import type { ReactNode } from "react";
import { headers, cookies } from "next/headers";
import { removeSensitiveHeaders } from "./headers";
import {
  headers as analyticsHeaders,
  restoreServerComponentContext,
} from "./server-component-context";
import { resolveAnonymousUser } from "./anonymous-user";
import { NextlyticsClient } from "./client";
import type {
  BackendWithConfig,
  ClientAction,
  DispatchResult,
  IngestPolicy,
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

type ResolvedBackend = {
  backend: NextlyticsBackend;
  ingestPolicy: IngestPolicy;
};

function isBackendWithConfig(entry: unknown): entry is BackendWithConfig {
  return typeof entry === "object" && entry !== null && "backend" in entry;
}

function resolveBackends(
  config: NextlyticsConfig,
  ctx: RequestContext,
  policyFilter?: IngestPolicy
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
    .filter((b): b is ResolvedBackend => b !== null)
    .filter((b) => !policyFilter || b.ingestPolicy === policyFilter);
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

/**
 * @deprecated Use the Server component returned by Nextlytics() instead.
 */
export async function NextlyticsServer({ children }: { children: ReactNode }) {
  console.warn(
    "[Nextlytics] NextlyticsServer is deprecated. Use the Server component from Nextlytics() instead:\n" +
      "  const { Server } = Nextlytics(config);\n" +
      "  // Then in layout: <Server>{children}</Server>"
  );
  return <>{children}</>;
}

export function Nextlytics(userConfig: NextlyticsConfig): NextlyticsResult {
  const config = withDefaults(userConfig);

  // Validate config and log warnings
  const validationResult = validateConfig(config);
  logConfigWarnings(validationResult);

  const dispatchEventInternal = (
    event: NextlyticsEvent,
    ctx: RequestContext,
    policyFilter?: IngestPolicy
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
    // Only update "immediate" backends that support updates
    const resolved = resolveBackends(config, ctx, "immediate").filter(
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

  const middleware = createNextlyticsMiddleware(config, dispatchEventInternal, updateEventInternal);

  /** Server component that provides analytics context to the app */
  async function Server({ children }: { children: ReactNode }) {
    const headersList = await headers();
    const ctx = restoreServerComponentContext(headersList);

    if (!ctx) {
      console.warn("[Nextlytics] nextlyticsMiddleware should be added in order for Server to work");
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

  const analytics = async () => {
    const headersList = await headers();
    const cookieStore = await cookies();
    const pageRenderId = headersList.get(analyticsHeaders.pageRenderId);

    const serverContext = createServerContextFromHeaders(headersList);
    const ctx: RequestContext = { headers: headersList, cookies: cookieStore };

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
          anonymousUserId,
          serverContext,
          userContext,
          properties: opts?.props || {},
        };
        await dispatchEventInternal(event, ctx);

        return { ok: true };
      },
    };
  };

  return {
    middleware,
    analytics,
    dispatchEvent,
    updateEvent,
    Server,
  };
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
