import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "Supabase",
  slug: "supabase",
  description:
    "Store analytics in Supabase via PostgREST API. " +
    "Works with any PostgREST-compatible endpoint for flexible Postgres storage.",
  type: "backend",
  tags: ["stable", "server-side"],
  logo: "/integrations/supabase.svg",
  logoSvg: [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">',
    "  <defs>",
    '    <linearGradient id="supa-grad" x1="0%" y1="0%" x2="100%" y2="100%">',
    '      <stop offset="0%" style="stop-color:#3ECF8E"/>',
    '      <stop offset="100%" style="stop-color:#3ECF8E;stop-opacity:0.6"/>',
    "    </linearGradient>",
    "  </defs>",
    '  <path fill="url(#supa-grad)" d="M35.3 58.7c-1.5 1.9-4.6.8-4.6-1.6V36h20.9c3.7 0 5.7 4.3 3.3 7.1L35.3 58.7z"/>',
    '  <path fill="#3ECF8E" d="M28.7 5.3c1.5-1.9 4.6-.8 4.6 1.6V28H12.4c-3.7 0-5.7-4.3-3.3-7.1L28.7 5.3z"/>',
    "</svg>",
  ].join("\n"),
  officialDocs: "https://supabase.com/docs",
  backendImport: 'import { postgrestBackend } from "@nextlytics/core/backends/postgrest";',
  backendConfig: [
    "    postgrestBackend({",
    '      url: process.env.SUPABASE_URL! + "/rest/v1",',
    "      apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,",
    "    }),",
  ].join("\n"),
};
