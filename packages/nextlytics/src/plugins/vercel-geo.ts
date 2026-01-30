import type { NextlyticsPlugin } from "../types";

/**
 * Vercel geo headers mapping.
 * See: https://vercel.com/docs/edge-network/headers#x-vercel-ip-country
 */
const VERCEL_GEO_HEADERS = {
  "x-vercel-ip-country": "country",
  "x-vercel-ip-country-region": "region",
  "x-vercel-ip-city": "city",
  "x-vercel-ip-latitude": "latitude",
  "x-vercel-ip-longitude": "longitude",
  "x-vercel-ip-timezone": "timezone",
} as const;

export type VercelGeoPluginOptions = {
  /** Property name to store geo data under. Default: "geo" */
  geoPropertyName?: string;
};

/**
 * Plugin that extracts Vercel geo headers and adds them to event properties.
 * Only works when deployed to Vercel.
 *
 * @example
 * ```ts
 * import { vercelGeoPlugin } from "nextlytics/plugins/vercel-geo";
 *
 * export const { middleware, handlers } = Nextlytics({
 *   plugins: [vercelGeoPlugin()],
 *   // ...
 * });
 * ```
 */
export function vercelGeoPlugin(options?: VercelGeoPluginOptions): NextlyticsPlugin {
  const geoPropertyName = options?.geoPropertyName ?? "geo";

  return {
    async onDispatch(event) {
      const headers = event.serverContext.requestHeaders;
      const geo: Record<string, string | number> = {};

      for (const [header, prop] of Object.entries(VERCEL_GEO_HEADERS)) {
        const value = headers[header];
        if (value) {
          // Convert lat/lng to numbers
          if (prop === "latitude" || prop === "longitude") {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              geo[prop] = num;
            }
          } else {
            geo[prop] = value;
          }
        }
      }

      // Only add geo if we found any data
      if (Object.keys(geo).length > 0) {
        event.properties[geoPropertyName] = geo;
      }
    },
  };
}
