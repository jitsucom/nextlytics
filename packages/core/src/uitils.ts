import type { NextRequest } from "next/server";
import type { ServerEventContext } from "./types";
import { removeSensitiveHeaders } from "./headers";

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Generate a random base62 ID (16 chars = 62^16 ≈ 4.7 × 10^28 combinations) */
export function generateId(): string {
  const length = 16;
  const bytes = new Uint8Array(length * 2);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    const idx = (bytes[i * 2] * 256 + bytes[i * 2 + 1]) % 62;
    result += BASE62_CHARS[idx];
  }
  return result;
}

export type RequestInfo = {
  /** True if this is a prefetch request (browser or Next.js router prefetch) */
  isPrefetch: boolean;
  /** True if this is an RSC (React Server Components) navigation */
  isRsc: boolean;
  /** True if this is a standard document or RSC navigation */
  isPageNavigation: boolean;
  /** True if this is a static file (ico, png, css, js, etc.) */
  isStaticFile: boolean;
  /** True if this is a Next.js internal path (/_next/*) */
  isNextjsInternal: boolean;
};

export function getRequestInfo(request: NextRequest): RequestInfo {
  const headers = request.headers;
  const pathname = request.nextUrl.pathname;

  // Check for Next.js internal paths
  const isNextjsInternal = pathname.startsWith("/_next");

  // Check for static files
  const isStaticFile = /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff2?|ttf|eot|map)$/i.test(
    pathname
  );

  // Standard prefetch detection via documented headers
  // Note: next-router-prefetch is often missing in App Router due to a bug
  // See: https://github.com/vercel/next.js/issues/63728
  const hasStandardPrefetchHeader =
    headers.get("next-router-prefetch") === "1" ||
    headers.get("purpose") === "prefetch" ||
    headers.get("sec-purpose") === "prefetch";

  // RSC prefetch heuristic using next-url header.
  // When next-url is present and differs from request path, it often indicates a prefetch
  // (hover/viewport). However, in Next.js 16 App Router, real navigations can also carry
  // next-url with a different pathname. That would incorrectly mark a real navigation as
  // prefetch if we rely on next-url alone.
  //
  // To avoid skipping real navigations, we only treat this as prefetch when the request
  // is NOT a page navigation. This keeps true prefetches skipped while allowing RSC
  // navigations to be counted as page views.
  //
  // References:
  // - https://github.com/vercel/next.js/issues/57762 (next-url header is undocumented)
  // - https://github.com/vercel/next.js/discussions/49824 (soft vs hard nav detection)
  // - https://github.com/vercel/next.js/discussions/37736 (prefetch detection workarounds)
  // Check for RSC navigation (client-side Next.js navigation)
  const nextUrl = headers.get("next-url");
  const isRsc = !!(nextUrl || headers.get("rsc"));

  // Check for standard document navigation
  const secFetchDest = headers.get("sec-fetch-dest");
  const secFetchMode = headers.get("sec-fetch-mode");
  const accept = headers.get("accept") || "";

  const isDocumentRequest = secFetchDest === "document" || secFetchMode === "navigate";
  const acceptsHtml = accept.includes("text/html");

  // Page navigation = document request OR RSC navigation OR accepts HTML
  const isPageNavigation = isRsc || isDocumentRequest || acceptsHtml;

  const isRscPrefetch = nextUrl !== null && nextUrl !== pathname;
  const isPrefetch = hasStandardPrefetchHeader || (isRscPrefetch && !isPageNavigation);

  return {
    isPrefetch,
    isRsc,
    isPageNavigation,
    isStaticFile,
    isNextjsInternal,
  };
}

export function createServerContext(request: NextRequest): ServerEventContext {
  const rawHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    rawHeaders[key] = value;
  });
  const requestHeaders = removeSensitiveHeaders(rawHeaders);

  const searchParams: Record<string, string[]> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    if (!searchParams[key]) {
      searchParams[key] = [];
    }
    searchParams[key].push(value);
  });

  return {
    collectedAt: new Date(),
    host: request.headers.get("host") || "",
    method: request.method,
    path: request.nextUrl.pathname,
    search: searchParams,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
    requestHeaders,
    responseHeaders: {},
  };
}
