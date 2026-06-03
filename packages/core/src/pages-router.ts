import type { NextlyticsContext } from "./client";
import { restoreServerComponentContext } from "./server-component-context";

export type PagesRouterContext = {
  req?: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> };
};

/**
 * Get Nextlytics props for Pages Router _app.tsx.
 * Reads context from headers set by middleware.
 *
 * `_app`'s getInitialProps re-runs on every client-side navigation, where there
 * is no `req`. Return an empty context in that case rather than throwing — the
 * client already has its scripts and templates from the initial render and the
 * /api/event round-trip.
 */
export function getNextlyticsProps(ctx: PagesRouterContext): NextlyticsContext {
  const reqHeaders = ctx?.req?.headers;
  if (!reqHeaders) {
    return { requestId: "" };
  }

  const headersList = new Headers();
  for (const [key, value] of Object.entries(reqHeaders)) {
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
