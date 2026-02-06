<p align="center">
  <img src="logo.svg" alt="Nextlytics" width="80" />
</p>

<h1 align="center">Nextlytics</h1>

<p align="center">
  <strong>Next.js Native Open-Source Analytics</strong>
</p>

<p align="center">
  100% server-side. No client JavaScript. No cookies. No GDPR banners.<br/>
  Just accurate analytics that respect your users.
</p>

<p align="center">
  <a href="https://nextlytics.sh">Website</a> ·
  <a href="https://nextlytics.sh/integrations">Integrations</a> ·
  <a href="https://nextlytics.sh/demo">Demo</a>
</p>

---

## What is Nextlytics?

Nextlytics is a server-side analytics library for Next.js. It tracks page views automatically via
middleware and lets you send custom events from server components, server actions, and API routes.

There's no client-side JavaScript involved. Events go directly from your server to your analytics
backend. This means no ad blockers, no cookies, and accurate data.

It works with multiple backends — Segment, PostHog, Google Analytics, or you can write directly to
a database like ClickHouse or Postgres.

## Install

```bash
npm install @nextlytics/core
```

## Quick Start

**1. Configure your backend** (`src/nextlytics.ts`)

```typescript
import { Nextlytics } from "@nextlytics/core/server";
import { segmentBackend } from "@nextlytics/core/backends/segment";
// Optional: import your auth library to track authenticated users
import { auth } from "./lib/auth"; // next-auth

export const { middleware, handlers, analytics } = Nextlytics({
  backends: [
    segmentBackend({
      writeKey: process.env.SEGMENT_WRITE_KEY!,
    }),
  ],
  // Optional but recommended: identify authenticated users
  callbacks: {
    async getUser() {
      const session = await auth();
      if (!session?.user) return null;
      return {
        userId: session.user.id,
        traits: { email: session.user.email, name: session.user.name },
      };
    },
  },
});
```

**2. Add to layout** (`src/app/layout.tsx`)

```tsx
import { NextlyticsServer } from "@nextlytics/core/server";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NextlyticsServer>{children}</NextlyticsServer>
      </body>
    </html>
  );
}
```

**3. Export middleware** (`src/middleware.ts`)

```typescript
import { middleware } from "./nextlytics";

export { middleware };
```

That's it. Every page view is now tracked server-side.

## Pages Router

Nextlytics also supports the Pages Router. The middleware works the same way, but instead of
`NextlyticsServer`, use `getNextlyticsProps` in your `_app.tsx`:

**1. Configure your backend** (same as App Router - see above)

**2. Add to \_app.tsx** (`pages/_app.tsx`)

```tsx
import type { AppContext, AppProps } from "next/app";
import { NextlyticsClient, getNextlyticsProps, type NextlyticsContext } from "@nextlytics/core";

type MyAppProps = AppProps & { nextlyticsCtx: NextlyticsContext };

function MyApp({ Component, pageProps, nextlyticsCtx }: MyAppProps) {
  return (
    <NextlyticsClient ctx={nextlyticsCtx}>
      <Component {...pageProps} />
    </NextlyticsClient>
  );
}

MyApp.getInitialProps = async (appContext: AppContext) => {
  return {
    pageProps: appContext.Component.getInitialProps
      ? await appContext.Component.getInitialProps(appContext.ctx)
      : {},
    nextlyticsCtx: getNextlyticsProps(appContext.ctx),
  };
};

export default MyApp;
```

**3. Export middleware** (same as App Router)

## Supported Backends

| Backend                                                                 | Type              |
| ----------------------------------------------------------------------- | ----------------- |
| [Segment or Jitsu](https://nextlytics.sh/integrations/segment)          | CDP               |
| [PostHog](https://nextlytics.sh/integrations/posthog)                   | Product Analytics |
| [Google Analytics](https://nextlytics.sh/integrations/google-analytics) | Web Analytics     |
| [ClickHouse](https://nextlytics.sh/integrations/clickhouse)             | Database          |
| [Neon](https://nextlytics.sh/integrations/neon) / Supabase              | Database          |

See [all integrations →](https://nextlytics.sh/integrations)

## License

MIT
