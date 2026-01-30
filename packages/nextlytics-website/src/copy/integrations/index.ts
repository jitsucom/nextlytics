import { meta as googleAnalyticsMeta } from "./google-analytics/meta";
import { meta as vercelGeoMeta } from "./vercel-geo/meta";
import { meta as posthogMeta } from "./posthog/meta";
import { meta as clickhouseMeta } from "./clickhouse/meta";
import { meta as gtmMeta } from "./google-tag-manager/meta";
import { meta as segmentMeta } from "./segment/meta";
import { meta as neonMeta } from "./neon/meta";
import { meta as supabaseMeta } from "./supabase/meta";
import { meta as debugLoggingMeta } from "./debug-logging/meta";
import { meta as amplitudeMeta } from "./amplitude/meta";
import { meta as mixpanelMeta } from "./mixpanel/meta";
import { meta as maxmindMeta } from "./maxmind/meta";
import type { IntegrationMeta } from "./types";

export type { IntegrationMeta, IntegrationType, IntegrationTag } from "./types";

export const integrations: IntegrationMeta[] = [
  googleAnalyticsMeta,
  posthogMeta,
  gtmMeta,
  segmentMeta,
  clickhouseMeta,
  neonMeta,
  supabaseMeta,
  debugLoggingMeta,
  vercelGeoMeta,
  maxmindMeta,
  amplitudeMeta,
  mixpanelMeta,
];

export function getIntegration(slug: string): IntegrationMeta | undefined {
  return integrations.find((i) => i.slug === slug);
}
