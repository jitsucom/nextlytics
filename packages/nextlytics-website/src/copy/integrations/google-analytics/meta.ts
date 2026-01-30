import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "Google Analytics",
  slug: "google-analytics",
  description:
    "Send analytics data to Google Analytics 4 via Measurement Protocol. " +
    "Supports server-side tracking with client-side page views.",
  type: "backend",
  tags: ["stable", "hybrid"],
  logo: "/integrations/google-analytics.svg",
  logoSvg: [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">',
    '  <path fill="#F9AB00" d="M42 58a6 6 0 1 1 0-12 6 6 0 0 1 0 12z"/>',
    '  <path fill="#E37400" d="M12 58c-3.3 0-6-2.7-6-6V12c0-3.3 2.7-6 6-6s6 2.7 6 6v40c0 3.3-2.7 6-6 6z"/>',
    '  <path fill="#F9AB00" d="M27 58c-3.3 0-6-2.7-6-6V27c0-3.3 2.7-6 6-6s6 2.7 6 6v25c0 3.3-2.7 6-6 6z"/>',
    '  <path fill="#E37400" d="M42 43c-3.3 0-6-2.7-6-6V12c0-3.3 2.7-6 6-6s6 2.7 6 6v25c0 3.3-2.7 6-6 6z"/>',
    "</svg>",
  ].join("\n"),
  officialDocs: "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
  snippet: [
    "// src/nextlytics.ts",
    'import { Nextlytics } from "nextlytics/server";',
    'import { googleAnalyticsBackend } from "nextlytics/backends/ga";',
    "",
    "export const { middleware, handlers, analytics } = Nextlytics({",
    "  backends: [",
    "    googleAnalyticsBackend({",
    '      measurementId: "G-XXXXXXXXXX",',
    "      apiSecret: process.env.GA_API_SECRET!,",
    "    }),",
    "  ],",
    "});",
  ].join("\n"),
};
