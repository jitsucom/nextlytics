import type { NextlyticsContext } from "./client";
import { restoreServerComponentContext } from "./server-component-context";
import type {
  BackendWithConfig,
  JavascriptTemplate,
  NextlyticsBackendFactory,
  NextlyticsConfig,
  RequestContext,
} from "./types";

export type PagesRouterContext = {
  req: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> };
};

function isBackendWithConfig(entry: unknown): entry is BackendWithConfig {
  return typeof entry === "object" && entry !== null && "backend" in entry;
}

/** Collect templates from backends */
function collectTemplatesFromConfig(
  config: NextlyticsConfig,
  ctx: RequestContext
): Record<string, JavascriptTemplate> {
  const templates: Record<string, JavascriptTemplate> = {};
  const entries = config.backends || [];

  for (const entry of entries) {
    let backend;
    if (isBackendWithConfig(entry)) {
      backend = typeof entry.backend === "function" ? entry.backend(ctx) : entry.backend;
    } else {
      backend = typeof entry === "function" ? (entry as NextlyticsBackendFactory)(ctx) : entry;
    }
    if (backend?.getClientSideTemplates) {
      Object.assign(templates, backend.getClientSideTemplates());
    }
  }
  return templates;
}

/**
 * Create a getNextlyticsProps function with config captured in closure.
 * Used internally by Nextlytics() to return a configured helper for Pages Router.
 */
export function createGetNextlyticsProps(config: NextlyticsConfig) {
  return function getNextlyticsProps(ctx: PagesRouterContext): NextlyticsContext {
    const headersList = new Headers();
    for (const [key, value] of Object.entries(ctx.req.headers)) {
      if (value) {
        headersList.set(key, Array.isArray(value) ? value[0] : value);
      }
    }

    const context = restoreServerComponentContext(headersList);
    if (!context) {
      return { requestId: "" };
    }

    const cookies = ctx.req.cookies || {};

    // Build request context for backend factories
    const requestCtx: RequestContext = {
      headers: headersList,
      cookies: {
        get: (name: string) => {
          const value = cookies[name];
          return value ? { name, value } : undefined;
        },
        getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
        has: (name: string) => name in cookies,
      },
    };

    const templates = collectTemplatesFromConfig(config, requestCtx);

    return {
      requestId: context.pageRenderId,
      scripts: context.scripts,
      templates,
    };
  };
}
