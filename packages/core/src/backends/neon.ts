import { neon } from "@neondatabase/serverless";
import type { NextlyticsBackend, NextlyticsEvent } from "../types";
import {
  tableColumns,
  eventToRow,
  extractClientContext,
  generatePgCreateTableSQL,
  isPgTableNotFoundError,
} from "./lib/db";

export type NeonBackendConfig = {
  databaseUrl: string;
  tableName?: string;
};

export function neonBackend(config: NeonBackendConfig): NextlyticsBackend {
  const sql = neon(config.databaseUrl);
  const table = config.tableName ?? "analytics";

  function printCreateTableStatement() {
    console.error(`[Nextlytics Neon] Table "${table}" does not exist. Run this SQL:\n`);
    console.error(generatePgCreateTableSQL(table));
  }

  return {
    name: "neon",
    supportsUpdates: true,

    async onEvent(event: NextlyticsEvent): Promise<void> {
      const values = eventToRow(event);
      const cols = tableColumns.map((c) => c.name).join(", ");
      const placeholders = tableColumns.map((_, i) => `$${i + 1}`).join(", ");

      try {
        await sql(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, [
          ...tableColumns.map((c) => values[c.name]),
        ]);
      } catch (err) {
        if (isPgTableNotFoundError(err)) {
          printCreateTableStatement();
        }
        throw err;
      }
    },

    async updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): Promise<void> {
      const sets: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (patch.clientContext) {
        const clientCtx = extractClientContext(patch.clientContext);
        const columns = {
          referer: clientCtx.referer,
          user_agent: clientCtx.user_agent,
          locale: clientCtx.locale,
        };

        for (const [col, val] of Object.entries(columns)) {
          if (val !== undefined) {
            sets.push(`${col} = $${paramIndex++}`);
            params.push(val);
          }
        }
        if (clientCtx.rest) {
          sets.push(`client_context = $${paramIndex++}::jsonb`);
          params.push(JSON.stringify(clientCtx.rest));
        }
      }

      if (sets.length > 0) {
        params.push(eventId);
        await sql(`UPDATE ${table} SET ${sets.join(", ")} WHERE event_id = $${paramIndex}`, params);
      }
    },
  };
}
