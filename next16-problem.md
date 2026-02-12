# Next16 App Router duplicate pageView issue

## Summary
On Next.js 16 App Router, a single client-side navigation triggers multiple RSC GET
requests that are indistinguishable by headers. Our middleware
(`packages/core/src/middleware.ts`) treats any RSC request as a page navigation,
so each RSC fetch emits a pageView, causing duplicates.

This does not reproduce on Next.js 15 because its request pattern either does
not emit these extra RSC fetches or they are not interpreted as navigations by
our heuristic (`packages/core/src/uitils.ts`).

## Evidence
Middleware logs in Next16 show repeated GETs for the same path with identical
header shapes (all marked `isRsc: true`, `isPageNavigation: true`). Example
observations:
- Multiple `/test-page` GETs for a single navigation (3+ observed in one run).
- Multiple `/` GETs immediately after navigating to `/test-page` (2+ observed).
- These requests share the same characteristic headers: `accept: */*`,
  `sec-fetch-dest: empty`, `sec-fetch-mode: cors`, and `next-url` present.
- `rsc` header is null; no `next-router-prefetch`, no `purpose`, no
  `x-nextjs-data`.

We do not currently have a reliable header discriminator between “the real
navigation” and the extra RSC fetches, so counting all RSC requests produces
multiple pageViews for a single navigation.

## Failing test
`e2e/tests/analytics.test.ts` → `tracks navigation between pages`

The test expects exactly two pageViews (home + test page), but Next16 yields
multiple pageViews in the DB.

Example failure:
```
AssertionError: expected 6 to be 2
```

## Repro command
```
bun run --cwd packages/core build && \
NEXTLYTICS_MIDDLEWARE_DEBUG=true \
NEXT_E2E_VERSION=next16 \
NEXT_E2E_ROUTER=app \
bun --cwd e2e vitest run tests/analytics.test.ts -t "tracks navigation between pages"
```

## Proposed fix (behavioral change)
Stop treating RSC requests as page navigations in middleware and count only
document navigations there.

Change in `packages/core/src/uitils.ts`:
```ts
// Before: page navigation = document OR RSC OR accepts HTML
const isPageNavigation = isRsc || isDocumentRequest || acceptsHtml;

// Proposed: page navigation = document OR accepts HTML (no RSC)
const isPageNavigation = isDocumentRequest || acceptsHtml;
```

### Implications
- Middleware (`packages/core/src/middleware.ts`) emits pageViews only for
  hard/document navigations.
- Soft navigations must be recorded via `/api/event` (client-init).
- To keep the immediate backend (PostgREST) updated on soft nav,
  `handleClientInit` in `packages/core/src/api-handler.ts` should include
  immediate backends when `softNavigation` is true.

## Why this is the safest heuristic
Next16 RSC fetches are not distinguishable from real navigations by headers in
our logs. Using document requests avoids duplicate pageViews and works
consistently across versions.
