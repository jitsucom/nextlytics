import type { NextResponse } from "next/server";
import type { JavascriptTemplate, TemplatizedScriptInsertion } from "./types";

const HEADER_PREFIX = "x-nc-";

const headerKeys = {
  pathname: `${HEADER_PREFIX}pathname`,
  search: `${HEADER_PREFIX}search`,
  pageRenderId: `${HEADER_PREFIX}page-render-id`,
  scripts: `${HEADER_PREFIX}scripts`,
  templates: `${HEADER_PREFIX}templates`,
} as const;

/** Context passed from middleware to server components via headers */
export type ServerComponentContext = {
  /** Unique page render ID (event ID) */
  pageRenderId: string;
  /** Request pathname */
  pathname: string;
  /** Query string */
  search: string;
  /** Script actions to execute on client */
  scripts: TemplatizedScriptInsertion<unknown>[];
  /** Template definitions for scripts */
  templates: Record<string, JavascriptTemplate>;
};

/** Serialize context to response headers (called in middleware) */
export function serializeServerComponentContext(
  response: NextResponse,
  ctx: ServerComponentContext
): void {
  response.headers.set(headerKeys.pageRenderId, ctx.pageRenderId);
  response.headers.set(headerKeys.pathname, ctx.pathname);
  response.headers.set(headerKeys.search, ctx.search);

  // Serialize scripts in compact format: templateId=params;templateId2=params2
  if (ctx.scripts.length > 0) {
    const scriptParts = ctx.scripts
      .filter((item) => item.type === "script-template")
      .map((s) => `${s.templateId}=${JSON.stringify(s.params)}`);
    if (scriptParts.length > 0) {
      response.headers.set(headerKeys.scripts, scriptParts.join(";"));
    }
  }

  // Serialize templates as JSON
  if (Object.keys(ctx.templates).length > 0) {
    response.headers.set(headerKeys.templates, JSON.stringify(ctx.templates));
  }
}

/** Parse compact scripts header: templateId=params;templateId2=params2 */
function parseScriptsHeader(header: string): TemplatizedScriptInsertion<unknown>[] {
  const scripts: TemplatizedScriptInsertion<unknown>[] = [];
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const templateId = part.slice(0, eqIdx);
    const paramsJson = part.slice(eqIdx + 1);
    try {
      const params = JSON.parse(paramsJson);
      scripts.push({ type: "script-template", templateId, params });
    } catch {
      console.warn(`[Nextlytics] Failed to parse script params for ${templateId}`);
    }
  }
  return scripts;
}

/** Restore context from request headers (called in server components) */
export function restoreServerComponentContext(headersList: Headers): ServerComponentContext | null {
  const pageRenderId = headersList.get(headerKeys.pageRenderId);
  if (!pageRenderId) {
    return null;
  }

  const pathname = headersList.get(headerKeys.pathname) || "";
  const search = headersList.get(headerKeys.search) || "";

  // Parse scripts
  const scriptsHeader = headersList.get(headerKeys.scripts);
  const scripts = scriptsHeader ? parseScriptsHeader(scriptsHeader) : [];

  // Parse templates
  let templates: Record<string, JavascriptTemplate> = {};
  const templatesHeader = headersList.get(headerKeys.templates);
  if (templatesHeader) {
    try {
      templates = JSON.parse(templatesHeader);
    } catch {
      console.warn("[Nextlytics] Failed to parse templates header");
    }
  }

  return {
    pageRenderId,
    pathname,
    search,
    scripts,
    templates,
  };
}

// Re-export header keys for backward compatibility
export { headerKeys as headers };
