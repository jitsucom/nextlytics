"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useNavigation, debug, InjectScript, type InjectScriptProps } from "./client-utils";
import type {
  ClientContext,
  ClientRequest,
  ClientRequestResult,
  JavascriptTemplate,
  ScriptElement,
  ScriptMode,
  TemplatizedScriptInsertion,
} from "./types";
import { headers } from "./server-component-context";
import { apply, compile, type TemplateFunctions } from "./template";

/** Context object for Pages Router integration */
export type NextlyticsContext = {
  requestId: string;
  scripts?: TemplatizedScriptInsertion<unknown>[];
  templates?: Record<string, JavascriptTemplate>;
};

const templateFunctions: TemplateFunctions = {
  q: (v) => JSON.stringify(v ?? null),
  json: (v) => JSON.stringify(v ?? null),
};

type NextlyticsContextValue = {
  requestId: string;
  templates: Record<string, JavascriptTemplate>;
  addScripts: (scripts: TemplatizedScriptInsertion<unknown>[]) => void;
  scriptsRef: React.MutableRefObject<TemplatizedScriptInsertion<unknown>[]>;
  subscribersRef: React.MutableRefObject<Set<() => void>>;
};

const NextlyticsContext = createContext<NextlyticsContextValue | null>(null);

function createClientContext(): ClientContext {
  const isBrowser = typeof window !== "undefined";
  return {
    collectedAt: new Date(),
    referer: isBrowser ? document.referrer || undefined : undefined,
    path: isBrowser ? window.location.pathname : undefined,
    url: isBrowser ? window.location.href : undefined,
    host: isBrowser ? window.location.host : undefined,
    search: isBrowser ? window.location.search : undefined,
    hash: isBrowser ? window.location.hash : undefined,
    title: isBrowser ? document.title : undefined,
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

/** Build deps array based on script modes */
function buildDeps(
  modes: (ScriptMode | undefined)[],
  paramsKey: string,
  requestId: string
): string[] {
  const deps: string[] = [];
  if (modes.some((m) => m === "on-params-change")) {
    deps.push(paramsKey);
  }
  if (modes.some((m) => m === "every-render" || m === undefined)) {
    deps.push(requestId);
  }
  return deps;
}

type CompiledScript = InjectScriptProps & { key: string };

/**
 * Compile scripts from templates into InjectScriptProps.
 * Groups consecutive body scripts together, keeps external scripts separate.
 */
function compileScripts(
  scripts: TemplatizedScriptInsertion<unknown>[],
  templates: Record<string, JavascriptTemplate>,
  requestId: string
): CompiledScript[] {
  const result: CompiledScript[] = [];

  for (const script of scripts) {
    if (script.type !== "script-template") continue;

    const template = templates[script.templateId];
    if (!template) {
      console.warn(`[Nextlytics] Template "${script.templateId}" not found`);
      continue;
    }

    const paramsRecord = script.params as Record<string, unknown>;
    const paramsKey = JSON.stringify(script.params);
    let currentBodyItems: ScriptElement[] = [];
    let groupIndex = 0;

    const flushBodyGroup = () => {
      if (currentBodyItems.length === 0) return;

      const body = currentBodyItems
        .map((item) => {
          if (!item.body) return "";
          const compiled = compile(item.body);
          return apply(compiled, paramsRecord, templateFunctions);
        })
        .join("\n");

      const deps = buildDeps(
        currentBodyItems.map((i) => i.mode),
        paramsKey,
        requestId
      );

      result.push({
        key: `${script.templateId}:body:${groupIndex}`,
        body,
        deps,
      });
      currentBodyItems = [];
      groupIndex++;
    };

    for (const item of template.items) {
      if (item.src) {
        // External script - flush pending body group first
        flushBodyGroup();

        const compiledSrc = compile(item.src);
        const src = apply(compiledSrc, paramsRecord, templateFunctions);

        result.push({
          key: `${script.templateId}:ext:${groupIndex}`,
          src,
          async: item.async,
          // deps: [] = load once
        });
        groupIndex++;
      } else if (item.body) {
        currentBodyItems.push(item);
      }
    }

    // Flush remaining body group
    flushBodyGroup();
  }

  return result;
}

/** Renders initial scripts (from SSR) and dynamic scripts (from sendEvent calls) */
function NextlyticsScripts({
  initialScripts,
}: {
  initialScripts: TemplatizedScriptInsertion<unknown>[];
}) {
  const context = useContext(NextlyticsContext);
  if (!context) {
    throw new Error("NextlyticsScripts should be called within NextlyticsContext");
  }

  const { scriptsRef, subscribersRef, templates, requestId } = context;
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Subscribe to dynamic script changes
  useEffect(() => {
    subscribersRef.current.add(forceUpdate);
    return () => {
      subscribersRef.current.delete(forceUpdate);
    };
  }, [subscribersRef]);

  const allScripts = [...initialScripts, ...scriptsRef.current];

  // Compile all scripts into InjectScriptProps
  const compiled = useMemo(
    () => compileScripts(allScripts, templates, requestId),
    [allScripts, templates, requestId]
  );

  debug("Rendering scripts", {
    initialCount: initialScripts.length,
    dynamicCount: scriptsRef.current.length,
    totalCount: allScripts.length,
    compiledCount: compiled.length,
  });

  return (
    <>
      {compiled.map(({ key, ...props }) => (
        <InjectScript key={key} {...props} />
      ))}
    </>
  );
}

async function sendEventToServer(
  requestId: string,
  request: ClientRequest,
  { signal }: { signal?: AbortSignal } = {}
): Promise<ClientRequestResult> {
  try {
    const response = await fetch("/api/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headers.pageRenderId]: requestId,
      },
      body: JSON.stringify(request),
      signal,
    });

    if (response.status === 404) {
      console.error(
        "[Nextlytics] In order for NextlyticsClient to work, you must install nextlytics middleware"
      );
      return { ok: false };
    }

    // Parse response to get scripts
    const data = await response.json().catch(() => ({ ok: response.ok }));
    return { ok: data.ok ?? response.ok, items: data.items };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false };
    }
    console.error("[Nextlytics] Failed to send event:", error);
    return { ok: false };
  }
}

export function NextlyticsClient(props: { ctx: NextlyticsContext; children?: ReactNode }) {
  const { requestId, scripts: initialScripts = [], templates = {} } = props.ctx;

  // Refs for dynamic scripts (from sendEvent calls) - stable, no re-renders
  const scriptsRef = useRef<TemplatizedScriptInsertion<unknown>[]>([]);
  const subscribersRef = useRef<Set<() => void>>(new Set());

  const addScripts = useCallback((newScripts: TemplatizedScriptInsertion<unknown>[]) => {
    debug("Adding scripts", {
      newCount: newScripts.length,
      templateIds: newScripts.map((s) => s.templateId),
    });
    scriptsRef.current = [...scriptsRef.current, ...newScripts];
    subscribersRef.current.forEach((cb) => cb());
  }, []);

  // Context value is stable - refs don't change identity
  const contextValue = useMemo<NextlyticsContextValue>(
    () => ({ requestId, templates, addScripts, scriptsRef, subscribersRef }),
    [requestId, templates, addScripts]
  );

  // Send client-init on mount and soft navigations
  useNavigation(requestId, ({ softNavigation, signal }) => {
    debug("Sending client-init", { requestId, softNavigation });
    const clientContext = createClientContext();
    sendEventToServer(
      requestId,
      { type: "client-init", clientContext, softNavigation: softNavigation || undefined },
      { signal }
    ).then(({ items }) => {
      debug("client-init response", { scriptsCount: items?.length ?? 0 });
      if (items?.length) addScripts(items);
    });
  });

  return (
    <NextlyticsContext.Provider value={contextValue}>
      {props.children}
      <NextlyticsScripts initialScripts={initialScripts} />
    </NextlyticsContext.Provider>
  );
}

export type NextlyticsClientApi = {
  sendEvent: (
    eventName: string,
    opts?: { props?: Record<string, unknown> }
  ) => Promise<{ ok: boolean }>;
};

export function useNextlytics(): NextlyticsClientApi {
  const context = useContext(NextlyticsContext);

  if (!context) {
    throw new Error(
      "[Nextlytics] useNextlytics() must be used within a component wrapped by <NextlyticsServer>. " +
        "Add <NextlyticsServer> at the top of your layout.tsx file."
    );
  }

  const { requestId, addScripts } = context;

  const sendEvent = useCallback(
    async (
      eventName: string,
      opts?: { props?: Record<string, unknown> }
    ): Promise<{ ok: boolean }> => {
      const result = await sendEventToServer(requestId, {
        type: "client-event",
        name: eventName,
        props: opts?.props,
        collectedAt: new Date().toISOString(),
        clientContext: createClientContext(),
      });

      if (result.items && result.items.length > 0) {
        addScripts(result.items);
      }

      return { ok: result.ok };
    },
    [requestId, addScripts]
  );

  return { sendEvent };
}
