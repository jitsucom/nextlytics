/**
 * PostgREST backend for Nextlytics
 *
 * Works with any PostgREST-compatible API including Supabase.
 *
 * ## Supabase Usage
 *
 * ```typescript
 * import { postgrestBackend } from "nextlytics/backends/postgrest"
 *
 * const analytics = Nextlytics({
 *   backends: [
 *     postgrestBackend({
 *       url: process.env.SUPABASE_URL! + "/rest/v1",
 *       apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
 *     })
 *   ]
 * })
 * ```
 *
 * ## Generic PostgREST Usage
 *
 * ```typescript
 * postgrestBackend({
 *   url: "https://your-postgrest-server.com",
 *   // apiKey is optional for non-Supabase PostgREST
 * })
 * ```
 */
import type { NextlyticsBackend, NextlyticsEvent } from "../types";
import { eventToRow, extractClientContext, generatePgCreateTableSQL } from "./lib/db";

export type PostgrestBackendConfig = {
  /** PostgREST API URL (e.g., "https://xxx.supabase.co/rest/v1") */
  url: string;
  /** API key for authentication (required for Supabase) */
  apiKey?: string;
  /** Table name (default: "analytics") */
  tableName?: string;
};

export function postgrestBackend(config: PostgrestBackendConfig): NextlyticsBackend {
  const table = config.tableName ?? "analytics";
  const baseUrl = config.url.replace(/\/$/, "");

  function headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    if (config.apiKey) {
      h["apikey"] = config.apiKey;
      h["Authorization"] = `Bearer ${config.apiKey}`;
    }
    return h;
  }

  function printCreateTableStatement() {
    console.error(`[Nextlytics PostgREST] Table "${table}" does not exist. Run this SQL:\n`);
    console.error(generatePgCreateTableSQL(table));
  }

  async function handleResponse(res: Response) {
    if (!res.ok) {
      const text = await res.text();
      if (text.includes("does not exist") || res.status === 404) {
        printCreateTableStatement();
      }
      throw new Error(`PostgREST error ${res.status}: ${text}`);
    }
  }

  return {
    name: "postgrest",
    supportsUpdates: true,

    async onEvent(event: NextlyticsEvent): Promise<void> {
      const row = eventToRow(event);
      const res = await fetch(`${baseUrl}/${table}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(row),
      });
      await handleResponse(res);
    },

    async updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): Promise<void> {
      if (!patch.clientContext) return;

      const clientCtx = extractClientContext(patch.clientContext);
      const updates: Record<string, unknown> = {};

      if (clientCtx.referer !== undefined) updates.referer = clientCtx.referer;
      if (clientCtx.user_agent !== undefined) updates.user_agent = clientCtx.user_agent;
      if (clientCtx.locale !== undefined) updates.locale = clientCtx.locale;
      if (clientCtx.rest) updates.client_context = clientCtx.rest;

      if (Object.keys(updates).length === 0) return;

      const res = await fetch(`${baseUrl}/${table}?event_id=eq.${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(updates),
      });
      await handleResponse(res);
    },
  };
}
