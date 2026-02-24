import type { NextRequest } from "next/server";
import type { ServerEventContext } from "./types";
import { removeSensitiveHeaders } from "./headers";

// --- Next.js version detection ---
//
// We read the installed Next.js version from next/package.json at build time.
// The bundler (webpack/turbopack) inlines the JSON so there's no filesystem
// access at runtime — works in Edge.
//
// Note: some Next.js prefetch-related headers are not reliably available in
// middleware, so header-based version heuristics are unreliable.
// See: https://github.com/vercel/next.js/issues/63728

let _nextVersion: string | undefined;

function detectNextVersion(): string | undefined {
  if (_nextVersion !== undefined) return _nextVersion;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("next/package.json") as { version: string };
    _nextVersion = pkg.version;
  } catch {
    console.warn(
      "[Nextlytics] Could not read Next.js version from next/package.json.\n" +
        "This can happen if your bundler does not support JSON imports from\n" +
        "node_modules. Ensure `resolveJsonModule: true` is set in tsconfig\n" +
        "and your bundler can resolve peer-dependency subpath imports.\n" +
        "Turbopack and webpack (default Next.js bundlers) both support this."
    );
    _nextVersion = "";
  }
  return _nextVersion || undefined;
}

function parseMajor(version: string | undefined): number | undefined {
  if (!version) return undefined;
  const major = parseInt(version.split(".")[0], 10);
  return Number.isFinite(major) ? major : undefined;
}

/** Returns the full installed Next.js version string (e.g. "16.1.6"), or undefined. */
export function getNextVersion(): string | undefined {
  return detectNextVersion();
}

/** True if the installed Next.js major version is 15. */
export function isNext15(): boolean {
  return parseMajor(detectNextVersion()) === 15;
}

/** True if the installed Next.js major version is 16. */
export function isNext16(): boolean {
  return parseMajor(detectNextVersion()) === 16;
}

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

  // Page navigation = document request OR accepts HTML.
  // RSC requests are excluded: on Next 15.5+ and Next 16 a single client-side
  // navigation can trigger multiple indistinguishable RSC fetches, causing
  // duplicate pageViews. Soft navigations are handled by the client /api/event
  // request instead.
  const isPageNavigation = isDocumentRequest || acceptsHtml;

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
