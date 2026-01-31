import type { ClientContext, NextlyticsEvent, ServerEventContext } from "../../types";

export const tableColumns = [
  { name: "event_id", pgType: "TEXT PRIMARY KEY", chType: "String" },
  { name: "parent_event_id", pgType: "TEXT", chType: "Nullable(String)" },
  { name: "timestamp", pgType: "TIMESTAMPTZ", chType: "DateTime64(3)" },
  { name: "type", pgType: "TEXT", chType: "LowCardinality(String)" },
  { name: "anonymous_user_id", pgType: "TEXT", chType: "Nullable(String)" },
  { name: "user_id", pgType: "TEXT", chType: "Nullable(String)" },
  { name: "user_email", pgType: "TEXT", chType: "Nullable(String)" },
  { name: "user_name", pgType: "TEXT", chType: "Nullable(String)" },
  { name: "host", pgType: "TEXT", chType: "LowCardinality(String)" },
  { name: "method", pgType: "TEXT", chType: "LowCardinality(String)" },
  { name: "path", pgType: "TEXT", chType: "String" },
  { name: "ip", pgType: "INET", chType: "Nullable(IPv6)" },
  { name: "referer", pgType: "TEXT", chType: "Nullable(String)" },
  { name: "user_agent", pgType: "TEXT", chType: "Nullable(String)" },
  { name: "locale", pgType: "TEXT", chType: "LowCardinality(Nullable(String))" },
  { name: "server_context", pgType: "JSONB", chType: "JSON" },
  { name: "client_context", pgType: "JSONB", chType: "JSON" },
  { name: "user_traits", pgType: "JSONB", chType: "JSON" },
  { name: "properties", pgType: "JSONB", chType: "JSON" },
] as const;

export type ColumnName = (typeof tableColumns)[number]["name"];

export type ClientContextColumns = {
  referer: string | undefined;
  user_agent: string | undefined;
  locale: string | undefined;
  rest: Record<string, unknown> | null;
};

export function extractClientContext(
  ctx: ClientContext | undefined,
  serverCtx?: ServerEventContext
): ClientContextColumns {
  // Server context fallbacks from request headers
  const serverReferer = serverCtx?.requestHeaders?.["referer"];
  const serverUserAgent = serverCtx?.requestHeaders?.["user-agent"];
  const serverLocale = serverCtx?.requestHeaders?.["accept-language"]?.split(",")[0];

  if (!ctx) {
    return {
      referer: serverReferer,
      user_agent: serverUserAgent,
      locale: serverLocale,
      rest: null,
    };
  }

  const { referer, userAgent, locale, ...rest } = ctx;
  return {
    referer: referer ?? serverReferer,
    user_agent: userAgent ?? serverUserAgent,
    locale: locale ?? serverLocale,
    rest: Object.keys(rest).length > 0 ? rest : null,
  };
}

function extractCommonFields(event: NextlyticsEvent) {
  const { host, method, path, ip, ...serverContextRest } = event.serverContext;
  const clientCtx = extractClientContext(event.clientContext, event.serverContext);

  const userTraitsRest = event.userContext?.traits
    ? (() => {
        const { email: _email, name: _name, ...rest } = event.userContext!.traits;
        return Object.keys(rest).length > 0 ? rest : null;
      })()
    : null;

  return {
    event_id: event.eventId,
    parent_event_id: event.parentEventId ?? null,
    timestamp: event.collectedAt,
    type: event.type,
    anonymous_user_id: event.anonymousUserId ?? null,
    user_id: event.userContext?.userId ?? null,
    user_email: event.userContext?.traits?.email ?? null,
    user_name: event.userContext?.traits?.name ?? null,
    host,
    method,
    path,
    ip: ip || null,
    referer: clientCtx.referer ?? null,
    user_agent: clientCtx.user_agent ?? null,
    locale: clientCtx.locale ?? null,
    serverContextRest,
    clientContextRest: clientCtx.rest,
    userTraitsRest,
    properties: event.properties,
  };
}

/** For PostgreSQL - JSON fields as strings */
export function eventToRow(event: NextlyticsEvent): Record<ColumnName, unknown> {
  const { serverContextRest, clientContextRest, userTraitsRest, properties, ...common } =
    extractCommonFields(event);
  return {
    ...common,
    server_context: JSON.stringify(serverContextRest),
    client_context: clientContextRest ? JSON.stringify(clientContextRest) : null,
    user_traits: userTraitsRest ? JSON.stringify(userTraitsRest) : null,
    properties: JSON.stringify(properties),
  };
}

/** For ClickHouse/PostgREST - JSON fields as objects */
export function eventToJsonRow(event: NextlyticsEvent): Record<ColumnName, unknown> {
  const { serverContextRest, clientContextRest, userTraitsRest, ...common } =
    extractCommonFields(event);
  return {
    ...common,
    server_context: serverContextRest,
    client_context: clientContextRest ?? {},
    user_traits: userTraitsRest ?? {},
  };
}

// Postgres
export function generatePgCreateTableSQL(tableName: string): string {
  const pk = tableColumns[0];
  const alters = tableColumns
    .slice(1)
    .map((col) => `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col.name} ${col.pgType};`)
    .join("\n");

  return `CREATE TABLE IF NOT EXISTS ${tableName} (${pk.name} ${pk.pgType});\n${alters}`;
}

export function isPgTableNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("does not exist");
}

// ClickHouse
export function generateChCreateTableSQL(database: string, tableName: string): string {
  const fullTable = `${database}.${tableName}`;
  // event_id must be in CREATE TABLE for ORDER BY
  const createCols = tableColumns
    .filter((c) => c.name === "event_id" || c.name === "timestamp")
    .map((c) => `${c.name} ${c.chType}`)
    .join(", ");
  const create =
    `CREATE TABLE IF NOT EXISTS ${fullTable} (${createCols}) ` +
    `ENGINE = ReplacingMergeTree() PARTITION BY toYYYYMM(timestamp) ORDER BY event_id;`;

  const alters = tableColumns
    .filter((c) => c.name !== "event_id" && c.name !== "timestamp")
    .map((c) => `ALTER TABLE ${fullTable} ADD COLUMN IF NOT EXISTS ${c.name} ${c.chType};`)
    .join("\n");

  return `${create}\n${alters}`;
}

export function isChTableNotFoundError(text: string): boolean {
  return text.includes("UNKNOWN_TABLE") || text.includes("doesn't exist");
}
