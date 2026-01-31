import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "MaxMind",
  slug: "maxmind",
  description:
    "Enrich analytics events with geolocation data from MaxMind GeoIP databases. " +
    "Get accurate country, city, and ISP information for any IP address.",
  type: "plugin",
  tags: ["coming-soon", "server-side"],
  logo: "/integrations/maxmind.svg",
  logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle fill="#00A1E0" cx="32" cy="32" r="26"/>
  <path fill="#fff" d="M32 14c-9.9 0-18 8.1-18 18s8.1 18 18 18 18-8.1 18-18-8.1-18-18-18zm0 32c-7.7 0-14-6.3-14-14s6.3-14 14-14 14 6.3 14 14-6.3 14-14 14z"/>
  <circle fill="#fff" cx="32" cy="32" r="6"/>
</svg>`,
  officialDocs: "https://www.maxmind.com/en/geoip-databases",
};
