/**
 * ClickHouse backend for Nextlytics
 *
 * Sends events to ClickHouse via HTTP API with async inserts.
 *
 * ## ClickHouse Cloud Usage
 *
 * ```typescript
 * import { clickhouseBackend } from "nextlytics/backends/clickhouse"
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
import { eventToRow, generateChCreateTableSQL, isChTableNotFoundError } from "./lib/db";

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
};

export function clickhouseBackend(config: ClickHouseBackendConfig): NextlyticsBackend {
  const baseUrl = config.url.replace(/\/$/, "");
  const database = config.database ?? "default";
  const table = config.tableName ?? "analytics";
  const asyncInsert = config.asyncInsert ?? true;

  const authHeader =
    "Basic " + btoa((config.username ?? "default") + ":" + (config.password ?? ""));

  function printCreateTableStatement() {
    console.error(`[Nextlytics ClickHouse] Table "${database}.${table}" does not exist. Run:\n`);
    console.error(generateChCreateTableSQL(database, table));
  }

  return {
    name: "clickhouse",
    supportsUpdates: false,

    async onEvent(event: NextlyticsEvent): Promise<void> {
      const row = eventToRow(event);
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
    },

    updateEvent() {
      // ClickHouse doesn't support updating rows efficiently
    },
  };
}
