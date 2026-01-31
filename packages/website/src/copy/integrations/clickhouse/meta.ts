import type { IntegrationMeta } from "../types";

export const meta: IntegrationMeta = {
  name: "ClickHouse",
  slug: "clickhouse",
  description:
    "Store analytics events directly in ClickHouse for blazing-fast queries. " +
    "Works with ClickHouse Cloud and self-hosted instances.",
  type: "backend",
  tags: ["stable", "server-side"],
  logo: "/integrations/clickhouse.svg",
  logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect fill="#FFCC00" x="6" y="8" width="8" height="48" rx="1"/>
  <rect fill="#FFCC00" x="18" y="8" width="8" height="48" rx="1"/>
  <rect fill="#FFCC00" x="30" y="8" width="8" height="48" rx="1"/>
  <rect fill="#FF0000" x="42" y="8" width="8" height="48" rx="1"/>
  <rect fill="#FFCC00" x="54" y="8" width="4" height="48" rx="1"/>
</svg>`,
  officialDocs: "https://clickhouse.com/docs",
};
