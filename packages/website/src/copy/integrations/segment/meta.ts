import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "Segment",
  slug: "segment",
  description:
    "Send events to Segment's HTTP Tracking API for routing to 300+ destinations. " +
    "Also compatible with Jitsu and other Segment-compatible endpoints.",
  type: "backend",
  tags: ["stable", "server-side"],
  logo: "/integrations/segment.svg",
  logoSvg: [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">',
    '  <path fill="#52BD94" d="M32 6C17.6 6 6 17.6 6 32s11.6 26 26 26 26-11.6 26-26S46.4 6 32 6zm0 44c-9.9 0-18-8.1-18-18s8.1-18 18-18 18 8.1 18 18-8.1 18-18 18z"/>',
    '  <path fill="#52BD94" d="M32 20c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>',
    "</svg>",
  ].join("\n"),
  officialDocs: "https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/",
  backendImport: 'import { segmentBackend } from "@nextlytics/core/backends/segment";',
  backendConfig: [
    "    segmentBackend({",
    "      writeKey: process.env.SEGMENT_WRITE_KEY!,",
    '      // For Jitsu: host: "https://ingest.g.jitsu.com"',
    "    }),",
  ].join("\n"),
};
