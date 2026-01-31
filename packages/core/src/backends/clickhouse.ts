/**
 * ClickHouse backend for Nextlytics
 *
 * Sends events to ClickHouse via HTTP API with async inserts.
 *
 * ## ClickHouse Cloud Usage
 *
 * ```typescript
 * import { clickhouseBackend } from "@nextlytics/core/backends/clickhouse"
 *
 * const analytics = Nextlytics({
 *   backends: [
 *     clickhouseBackend({
 *       url: "https://xxx.clickhouse.cloud:8443",
 *       username: "default",
 *       password: process.env.CLICKHOUSE_PASSWORD!,
 *     })
 *   ]
 * })
 * ```
 *
 * ## Self-hosted ClickHouse
 *
 * ```typescript
 * clickhouseBackend({
 *   url: "http://localhost:8123",
 *   username: "default",
 *   password: "",
 *   database: "analytics",
 * })
 * ```
 */
import type { NextlyticsBackend, NextlyticsEvent } from "../types";
import {
  tableColumns,
  eventToJsonRow,
  generateChCreateTableSQL,
  isChTableNotFoundError,
  extractClientContext,
} from "./lib/db";

export type ClickHouseBackendConfig = {
  /** ClickHouse HTTP API URL */
  url: string;
  /** Username (default: "default") */
  username?: string;
  /** Password */
  password?: string;
  /** Database name (default: "default") */
  database?: string;
  /** Table name (default: "analytics") */
  tableName?: string;
  /** Enable async inserts (default: true) */
  asyncInsert?: boolean;
  /** Enable updates via select+insert (uses ReplacingMergeTree deduplication) */
  acceptUpdates?: boolean;
  /** Lookback window in minutes for update SELECT queries (default: 60) */
  updateLookbackMinutes?: number;
};

export function clickhouseBackend(config: ClickHouseBackendConfig): NextlyticsBackend {
  const baseUrl = config.url.replace(/\/$/, "");
  const database = config.database ?? "default";
  const table = config.tableName ?? "analytics";
  const asyncInsert = config.asyncInsert ?? true;
  const acceptUpdates = config.acceptUpdates ?? false;
  const updateLookbackMinutes = config.updateLookbackMinutes ?? 60;

  const authHeader =
    "Basic " + btoa((config.username ?? "default") + ":" + (config.password ?? ""));

  function printCreateTableStatement() {
    console.error(`[Nextlytics ClickHouse] Table "${database}.${table}" does not exist. Run:\n`);
    console.error(generateChCreateTableSQL(database, table));
  }

  async function query<T>(sql: string): Promise<T[]> {
    const params = new URLSearchParams({
      database,
      query: sql,
    });
    const res = await fetch(`${baseUrl}/?${params}`, {
      method: "GET",
      headers: { Authorization: authHeader },
    });
    if (!res.ok) {
      throw new Error(`ClickHouse query error ${res.status}: ${await res.text()}`);
    }
    const text = await res.text();
    if (!text.trim()) return [];
    return text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }

  async function insert(row: Record<string, unknown>): Promise<void> {
    const params = new URLSearchParams({
      database,
      query: `INSERT INTO ${table} FORMAT JSONEachRow`,
      date_time_input_format: "best_effort",
    });
    if (asyncInsert) {
      params.set("async_insert", "1");
      params.set("wait_for_async_insert", "0");
    }

    const res = await fetch(`${baseUrl}/?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const text = await res.text();
      if (isChTableNotFoundError(text)) {
        printCreateTableStatement();
      }
      throw new Error(`ClickHouse error ${res.status}: ${text}`);
    }
  }

  return {
    name: "clickhouse",
    supportsUpdates: acceptUpdates,

    async onEvent(event: NextlyticsEvent): Promise<void> {
      const row = eventToJsonRow(event);
      await insert(row);
    },

    async updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): Promise<void> {
      if (!acceptUpdates || !patch.clientContext) return;

      // Select existing row (with lookback window to leverage partitioning)
      const cols = tableColumns.map((c) => c.name).join(", ");
      const rows = await query<Record<string, unknown>>(
        `SELECT ${cols} FROM ${table} ` +
          `WHERE event_id = '${eventId}' AND timestamp > now() - INTERVAL ${updateLookbackMinutes} MINUTE ` +
          `FORMAT JSONEachRow`
      );
      if (rows.length === 0) return;

      const existing = rows[0];
      const clientCtx = extractClientContext(patch.clientContext);

      // Merge patch into existing row
      const updated = {
        ...existing,
        referer: clientCtx.referer ?? existing.referer,
        user_agent: clientCtx.user_agent ?? existing.user_agent,
        locale: clientCtx.locale ?? existing.locale,
        client_context: clientCtx.rest ?? existing.client_context,
      };

      // Insert updated row (ReplacingMergeTree will deduplicate by event_id)
      await insert(updated);
    },
  };
}
