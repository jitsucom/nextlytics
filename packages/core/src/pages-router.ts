import type { NextlyticsContext } from "./client";
import { restoreServerComponentContext } from "./server-component-context";

export type PagesRouterContext = {
  req: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> };
};

/**
 * Get Nextlytics props for Pages Router _app.tsx.
 * Reads context from headers set by middleware.
 */
export function getNextlyticsProps(ctx: PagesRouterContext): NextlyticsContext {
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

  return {
    requestId: context.pageRenderId,
    scripts: context.scripts,
  };
}
