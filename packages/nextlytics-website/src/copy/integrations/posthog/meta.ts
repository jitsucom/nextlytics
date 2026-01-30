import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "PostHog",
  slug: "posthog",
  description:
    "Send analytics events to PostHog for product analytics and session replay. " +
    "Server-side tracking with full user identification support.",
  type: "backend",
  tags: ["stable", "server-side"],
  logo: "/integrations/posthog.svg",
  logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <path fill="#1D4AFF" d="M16 8h32l-8 16h8L24 56l8-24h-8l-8-24z"/>
</svg>`,
  officialDocs: "https://posthog.com/docs",
};
