import { meta as segmentMeta } from "./integrations/segment/meta";
import { meta as supabaseMeta } from "./integrations/supabase/meta";
import { meta as googleAnalyticsMeta } from "./integrations/google-analytics/meta";

export const tagline = "Next.js Native Open-Source Analytics";

export const description =
  "100% server-side. No client JavaScript. No cookies. No GDPR banners. " +
  "Just accurate analytics that respect your users.";

export const packageManagers = {
  npm: "npm install @nextlytics/core",
  bun: "bun add @nextlytics/core",
  pnpm: "pnpm add @nextlytics/core",
  yarn: "yarn add @nextlytics/core",
} as const;

const defaultAuthImport = 'import { auth } from "./lib/auth"; // next-auth';
const defaultAuthCallback = [
  "    async getUser() {",
  "      const session = await auth();",
  "      if (!session?.user) return null;",
  "      return {",
  "        userId: session.user.id,",
  "        traits: { email: session.user.email, name: session.user.name },",
  "      };",
  "    },",
].join("\n");

type ConfigSnippetOptions = {
  backendImport: string;
  backendConfig: string;
  authImport?: string;
  authCallback?: string;
};

/**
 * Generates a full Nextlytics config snippet with the given backend-specific parts.
 */
export function configSnippet(opts: ConfigSnippetOptions): string {
  const authImport = opts.authImport ?? defaultAuthImport;
  const authCallback = opts.authCallback ?? defaultAuthCallback;
  return [
    "// src/nextlytics.ts",
    'import { Nextlytics } from "@nextlytics/core/server";',
    opts.backendImport,
    "// Optional: import your auth library to track authenticated users",
    authImport,
    "",
    "export const { middleware, handlers, analytics } = Nextlytics({",
    "  backends: [",
    opts.backendConfig,
    "  ],",
    "  // Optional but recommended: identify authenticated users",
    "  callbacks: {",
    authCallback,
    "  },",
    "});",
  ].join("\n");
}

export const backendConfigs = {
  segment: {
    label: "Segment or Jitsu",
    code: configSnippet({
      backendImport: segmentMeta.backendImport!,
      backendConfig: segmentMeta.backendConfig!,
    }),
  },
  supabase: {
    label: "Supabase",
    code: configSnippet({
      backendImport: supabaseMeta.backendImport!,
      backendConfig: supabaseMeta.backendConfig!,
      authImport: supabaseMeta.authImport,
      authCallback: supabaseMeta.authCallback,
    }),
  },
  ga: {
    label: "Google Analytics",
    code: configSnippet({
      backendImport: googleAnalyticsMeta.backendImport!,
      backendConfig: googleAnalyticsMeta.backendConfig!,
    }),
  },
} as const;

export const integrationFiles = {
  layout: {
    filename: "src/app/layout.tsx",
    code: [
      'import { NextlyticsServer } from "@nextlytics/core/server";',
      "",
      "export default function RootLayout({ children }) {",
      "  return (",
      '    <html lang="en">',
      "      <body>",
      "        <NextlyticsServer>{children}</NextlyticsServer>",
      "      </body>",
      "    </html>",
      "  );",
      "}",
    ].join("\n"),
  },
  middleware: {
    filename: "src/middleware.ts",
    code: ['import { middleware } from "./nextlytics";', "", "export { middleware };"].join("\n"),
  },
} as const;

export const benefits = [
  {
    title: "100% Server-Side",
    description:
      "All tracking happens in Next.js middleware. No client JavaScript, no external calls. " +
      "100% accurate data, immune to ad blockers.",
  },
  {
    title: "GDPR Compliant",
    description:
      "No cookies, no fingerprinting, no personal data stored. " +
      "Skip the cookie banners entirely.",
  },
  {
    title: "Zero Overhead",
    description:
      "No impact on page load. No additional network requests from browsers. " +
      "Your site stays fast.",
  },
  {
    title: "Backend-Agnostic",
    description:
      "Send data to Posthog, Segment, Jitsu, or write directly to Postgres. " +
      "Use what you already have.",
  },
] as const;

export const features = [
  {
    title: "Anonymous & Authenticated",
    description:
      "Track both anonymous visitors and logged-in users. Integrates seamlessly with NextAuth.",
  },
  {
    title: "Custom Events",
    description:
      "Track form submissions, button clicks, and any custom event from your server components.",
  },
  {
    title: "Multiple Backends",
    description: "Posthog, Segment, Amplitude, or write directly to your database. Switch anytime.",
  },
  {
    title: "Open Source",
    description: "MIT licensed. No vendor lock-in, no hidden costs. Your data, your rules.",
  },
] as const;
