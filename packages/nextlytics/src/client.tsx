"use client";

import { useEffect, useCallback, useRef } from "react";
import type { ClientContext, JavascriptTemplate, TemplatizedScriptInsertion } from "./types";
import { headers } from "./headers";
import { compile, apply, type CompiledTemplate, type TemplateFunctions } from "./template";

let currentRequestId: string | null = null;
let currentTemplates: Record<string, JavascriptTemplate> = {};

const templateFunctions: TemplateFunctions = {
  q: (v) => JSON.stringify(v ?? null),
  json: (v) => JSON.stringify(v ?? null),
};
// Cache compiled templates to avoid recompiling
const compiledCache: Record<string, { src?: CompiledTemplate; body?: CompiledTemplate }> = {};

function createClientContext(): ClientContext {
  const isBrowser = typeof window !== "undefined";
  return {
    collectedAt: new Date(),
    referer: isBrowser ? document.referrer || undefined : undefined,
    path: isBrowser ? window.location.pathname : undefined,
    screen: {
      width: isBrowser ? window.screen.width : undefined,
      height: isBrowser ? window.screen.height : undefined,
      innerWidth: isBrowser ? window.innerWidth : undefined,
      innerHeight: isBrowser ? window.innerHeight : undefined,
      density: isBrowser ? window.devicePixelRatio : undefined,
    },
    userAgent: isBrowser ? navigator.userAgent : undefined,
    locale: isBrowser ? navigator.language : undefined,
  };
}

/** Get or compile template items */
function getCompiledTemplate(
  templateId: string,
  itemIndex: number,
  item: { src?: string; body?: string }
): { src?: CompiledTemplate; body?: CompiledTemplate } {
  const cacheKey = `${templateId}:${itemIndex}`;
  if (!compiledCache[cacheKey]) {
    compiledCache[cacheKey] = {
      src: item.src ? compile(item.src) : undefined,
      body: item.body ? compile(item.body) : undefined,
    };
  }
  return compiledCache[cacheKey];
}

/** Execute templated scripts */
function executeTemplatedScripts(
  scripts: TemplatizedScriptInsertion<unknown>[] | undefined,
  templates: Record<string, JavascriptTemplate>
) {
  if (!scripts || typeof window === "undefined") return;

  for (const script of scripts) {
    if (script.type !== "script-template") {
      console.warn(`[Nextlytics] unsupported script type ${script.type} `);
      continue;
    }

    const template = templates[script.templateId];
    if (!template) {
      console.warn(`[Nextlytics] Missing template: ${script.templateId}`);
      continue;
    }

    const params = script.params as Record<string, unknown>;

    // Execute each script element in the template
    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i];
      const compiled = getCompiledTemplate(script.templateId, i, item);

      const src = compiled.src ? apply(compiled.src, params, templateFunctions) : undefined;

      // Skip if singleton and script with same src already exists
      if (item.singleton && src && document.querySelector(`script[src="${src}"]`)) {
        continue;
      }

      const el = document.createElement("script");
      if (src) {
        el.src = src;
      }
      if (compiled.body) {
        el.textContent = apply(compiled.body, params, templateFunctions);
      }
      if (item.async) {
        el.async = true;
      }

      document.head.appendChild(el);
    }
  }
}

type SendEventResult = {
  ok: boolean;
  scripts?: TemplatizedScriptInsertion<unknown>[];
};

async function sendEvent(
  requestId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<SendEventResult> {
  try {
    const response = await fetch("/api/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headers.pageRenderId]: requestId,
      },
      body: JSON.stringify({ type, payload }),
    });

    if (response.status === 404) {
      console.error(
        "[Nextlytics] In order for NextlyticsClient to work, you must mount nextlyticsRouteHandler to /api/event"
      );
      return { ok: false };
    }

    // Parse response to get scripts
    const data = await response.json().catch(() => ({ ok: response.ok }));
    return { ok: data.ok ?? response.ok, scripts: data.scripts };
  } catch (error) {
    console.error("[Nextlytics] Failed to send event:", error);
    return { ok: false };
  }
}

export function NextlyticsClient(props: {
  requestId: string;
  scripts?: TemplatizedScriptInsertion<unknown>[];
  templates?: Record<string, JavascriptTemplate>;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    currentRequestId = props.requestId;
    if (props.templates) {
      currentTemplates = props.templates;
    }

    if (initialized.current) return;
    initialized.current = true;

    // Execute scripts from server (pageView)
    if (props.scripts && props.templates) {
      executeTemplatedScripts(props.scripts, props.templates);
    }

    // Send client-init and execute any returned scripts
    const clientContext = createClientContext();
    sendEvent(
      props.requestId,
      "client-init",
      clientContext as unknown as Record<string, unknown>
    ).then(({ scripts }) => {
      if (scripts) {
        executeTemplatedScripts(scripts, currentTemplates);
      }
    });
  }, [props.requestId, props.scripts, props.templates]);

  return null;
}

export type NexlyticsClient = {
  sendEvent: (
    eventName: string,
    opts?: { props?: Record<string, unknown> }
  ) => Promise<{ ok: boolean }>;
};

export function useNextlytics(): NexlyticsClient {
  const send = useCallback(
    async (
      eventName: string,
      opts?: { props?: Record<string, unknown> }
    ): Promise<{ ok: boolean }> => {
      if (!currentRequestId) {
        console.error("[Nextlytics] useNextlytics requires <NextlyticsClient /> to be mounted");
        return { ok: false };
      }

      const result = await sendEvent(currentRequestId, "client-event", {
        name: eventName,
        props: opts?.props,
        collectedAt: new Date().toISOString(),
        clientContext: createClientContext(),
      });

      // Execute any scripts returned from the event
      if (result.scripts) {
        executeTemplatedScripts(result.scripts, currentTemplates);
      }

      return { ok: result.ok };
    },
    []
  );

  return { sendEvent: send };
}
