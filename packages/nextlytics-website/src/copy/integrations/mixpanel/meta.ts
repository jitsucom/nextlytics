import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "Mixpanel",
  slug: "mixpanel",
  description:
    "Send events to Mixpanel for product analytics and user tracking. " +
    "Server-side event ingestion with full property support.",
  type: "backend",
  tags: ["coming-soon", "server-side"],
  logo: "/integrations/mixpanel.svg",
  logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <path fill="#7856FF" d="M32 6C17.6 6 6 17.6 6 32s11.6 26 26 26 26-11.6 26-26S46.4 6 32 6z"/>
  <path fill="#fff" d="M22 26h4v16h-4V26zm8-6h4v22h-4V20zm8 10h4v12h-4V30z"/>
</svg>`,
  officialDocs: "https://developer.mixpanel.com/",
};
