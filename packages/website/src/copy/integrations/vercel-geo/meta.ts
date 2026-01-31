import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "Vercel Geo",
  slug: "vercel-geo",
  description:
    "Automatically enrich analytics events with geographic data from Vercel's edge network. " +
    "Get country, region, city, and coordinates without any external API calls.",
  type: "plugin",
  tags: ["stable", "server-side"],
  logo: "/integrations/vercel.svg",
  logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <path fill="#000" d="M32 8L58 56H6L32 8z"/>
</svg>`,
  officialDocs: "https://vercel.com/docs/edge-network/headers#x-vercel-ip-country",
};
