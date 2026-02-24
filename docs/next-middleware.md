# Next.js middleware and page view tracking

In Nextlytics we capture analytics events as close to the server as
possible — ideally in Next.js middleware, before the response is sent.
This gives us access to server context (IP, headers, geo) without
relying on client-side JavaScript. However, Next.js middleware has
significant limitations when it comes to detecting client-side
navigations, especially in newer versions.

This document summarizes our findings and the rationale behind the
approach we took.

## Goal

Capture exactly one `pageView` event per navigation — both hard navigations
(full document load) and soft navigations (client-side route changes via
Next.js App Router).

## How Next.js App Router navigation works

### Hard navigation

Browser requests a full HTML document. Middleware sees a standard request:

```
GET /some-page
sec-fetch-dest: document
sec-fetch-mode: navigate
accept: text/html,...
```

One request, one page view. Straightforward.

### Soft navigation (client-side)

When the user clicks a `<Link>`, the App Router fetches RSC (React Server
Components) payloads instead of full HTML. The browser sends one or more
GET requests with headers like:

```
GET /some-page
sec-fetch-dest: empty
sec-fetch-mode: cors
accept: */*
next-url: /previous-page
```

These are NOT document requests — they're fetch() calls made by the
router. Middleware sees every one of them.

## The problem: RSC requests in middleware

### Next.js 15 (early versions)

RSC navigations sent identifiable headers (`rsc: 1`, `x-nextjs-data: 1`).
A single soft navigation typically produced one RSC request. Counting RSC
requests as page views worked — one RSC request, one page view.

### Next.js 15.5+

The `rsc` and `x-nextjs-data` headers were dropped. RSC requests now carry
only `next-url` with no other distinguishing markers. Prefetch requests
look identical to navigation requests from middleware's perspective.

### Next.js 16: per-segment fetching

Next 16 introduced the Client Segment Cache. Instead of fetching a single
RSC payload per route, the router decomposes routes into segments (layouts,
pages) and fetches each independently. A single navigation to `/some-page`
can trigger 3+ GET requests:

1. Route tree fetch (`Next-Router-Segment-Prefetch: /_tree`)
2. Root layout segment (`Next-Router-Segment-Prefetch: /_index`)
3. Page segment (`Next-Router-Segment-Prefetch: /__PAGE__`)

Each request goes to the same URL path. The `Next-Router-Segment-Prefetch`
header distinguishes them — but **this header is not reliably available in
middleware**. See https://github.com/vercel/next.js/issues/63728.

What middleware actually sees for all three requests:

```
GET /some-page
accept: */*
sec-fetch-dest: empty
sec-fetch-mode: cors
next-url: /previous-page
```

No `rsc`, no `next-router-segment-prefetch`, no `next-router-prefetch`.
The requests are completely identical from middleware's perspective.

### Observed behavior (from e2e tests)

Navigating from `/` to `/test-page` in Next 16 produced these middleware
hits:

| # | path         | next-url | rsc  | notes                    |
|---|--------------|----------|------|--------------------------|
| 1 | `/test-page` | `/`      | null | segment fetch            |
| 2 | `/test-page` | `/`      | null | segment fetch (identical)|
| 3 | `/test-page` | `/`      | null | segment fetch (identical)|

All three have identical headers. Treating any of them as a page view
produces 3 `pageView` events for a single navigation.

## Why version-aware detection failed

We tried detecting the Next.js version from request headers to apply
different logic per version:

- `next-router-segment-prefetch` present → Next 16
- `x-nextjs-data` present → Next 15
- `next-url` without `rsc` → Next 16 (heuristic)

This broke because Next 15.5+ dropped `rsc` and `x-nextjs-data`, making
its RSC requests identical to Next 16's. The `next-url && !rsc` heuristic
incorrectly classified Next 15.5 as Next 16.

Reliable version detection is possible via `require("next/package.json")`
(see `packages/core/src/uitils.ts`), but version-aware middleware logic
is unnecessary — the fix works for all versions.

## Solution

### Middleware: only track document requests

```ts
// packages/core/src/uitils.ts
const isPageNavigation = isDocumentRequest || acceptsHtml;
// RSC requests are excluded — they can't be reliably counted
```

```ts
// packages/core/src/middleware.ts
if (!reqInfo.isPageNavigation && !config.isApiPath(pathname)) {
  return NextResponse.next(); // skip RSC fetches, prefetches, etc.
}
```

Middleware dispatches `pageView` events only for hard navigations
(document requests).

### Client: handle soft navigation dispatch

When the client detects a soft navigation, it sends a `page-view` request
to `/api/event`. The handler (`packages/core/src/api-handler.ts`)
dispatches to **all** backends with full server + client context:

```ts
if (isSoftNavigation) {
  // Middleware didn't fire for this navigation — dispatch to all backends
  const { clientActions, completion } = dispatchEvent(event, ctx);
  // ...
}
```

### Result

| Navigation type | Tracked by     | Backends          |
|-----------------|----------------|-------------------|
| Hard (document) | Middleware      | on-request (immediate), then client-actions + update |
| Soft (RSC)      | Client /api/event | All backends in one dispatch |

One `pageView` per navigation, regardless of how many RSC requests
Next.js fires internally.

## Debug logging

Set `NEXTLYTICS_MIDDLEWARE_DEBUG=true` to see all requests hitting
middleware, including the detected Next.js version:

```
[Nextlytics][middleware] {
  url: 'http://localhost:3000/test-page',
  pathname: '/test-page',
  nextVersion: '16.1.6',
  isPrefetch: false,
  isRsc: true,
  isPageNavigation: false,
  ...
}
```

## References

- https://github.com/vercel/next.js/issues/63728 —
  prefetch headers not available in middleware
- https://github.com/vercel/next.js/issues/85489 —
  multiple prefetch requests per navigation (confirmed by Next.js team)
- https://nextjs.org/blog/next-16 — Client Segment Cache architecture
- https://github.com/vercel/next.js/issues/57762 — `next-url` header
  is undocumented
