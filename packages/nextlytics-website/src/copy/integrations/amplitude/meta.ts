import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "Amplitude",
  slug: "amplitude",
  description:
    "Send events to Amplitude for product analytics. " +
    "Track user behavior and build funnels with server-side event collection.",
  type: "backend",
  tags: ["coming-soon", "server-side"],
  logo: "/integrations/amplitude.svg",
  logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle fill="#1A73E8" cx="32" cy="32" r="26"/>
  <path fill="#fff" d="M20 44V28l12-12 12 12v16H36v-8h-8v8H20z"/>
</svg>`,
  officialDocs: "https://www.docs.developers.amplitude.com/",
};
