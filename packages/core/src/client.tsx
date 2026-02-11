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
import { usePathname } from "next/navigation";
import type {
  ClientContext,
  ClientRequest,
  JavascriptTemplate,
  ScriptElement,
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

/** Component that injects a single script element with proper lifecycle management */
function InjectScript({
  item,
  params,
  requestId,
}: {
  item: ScriptElement;
  params: unknown;
  requestId: string;
}) {
  const mode = item.mode ?? "every-render";
  const paramsJson = JSON.stringify(params);
  const paramsRecord = params as Record<string, unknown>;

  // Cache compiled templates
  const compiledSrc = useMemo(() => (item.src ? compile(item.src) : null), [item.src]);
  const compiledBody = useMemo(() => (item.body ? compile(item.body) : null), [item.body]);

  // Separate effects for each mode to satisfy exhaustive-deps
  const hasRun = useRef(false);

  // Mode: "once" - run only on first mount
  useEffect(() => {
    if (mode !== "once" || hasRun.current) return;
    hasRun.current = true;

    const src = compiledSrc ? apply(compiledSrc, paramsRecord, templateFunctions) : undefined;
    const body = compiledBody ? apply(compiledBody, paramsRecord, templateFunctions) : undefined;

    const el = document.createElement("script");
    if (src) el.src = src;
    if (body) el.textContent = body;
    if (item.async) el.async = true;
    document.head.appendChild(el);
    // No cleanup for "once" scripts - they persist
  }, [mode, compiledSrc, compiledBody, paramsRecord, item.async]);

  // Mode: "on-params-change" - run when params change
  // Using paramsJson (serialized) in deps for content-based comparison,
  // while using paramsRecord in effect body. This is intentional.
  useEffect(() => {
    if (mode !== "on-params-change") return;

    const src = compiledSrc ? apply(compiledSrc, paramsRecord, templateFunctions) : undefined;
    const body = compiledBody ? apply(compiledBody, paramsRecord, templateFunctions) : undefined;

    const el = document.createElement("script");
    if (src) el.src = src;
    if (body) el.textContent = body;
    if (item.async) el.async = true;
    document.head.appendChild(el);

    return () => el.remove();
  }, [mode, paramsJson, compiledSrc, compiledBody, item.async]);

  // Mode: "every-render" - run on every navigation
  useEffect(() => {
    if (mode !== "every-render") return;

    const src = compiledSrc ? apply(compiledSrc, paramsRecord, templateFunctions) : undefined;
    const body = compiledBody ? apply(compiledBody, paramsRecord, templateFunctions) : undefined;

    const el = document.createElement("script");
    if (src) el.src = src;
    if (body) el.textContent = body;
    if (item.async) el.async = true;
    document.head.appendChild(el);

    return () => el.remove();
  }, [mode, requestId, compiledSrc, compiledBody, paramsRecord, item.async]);

  return null;
}

/** Merge scripts by templateId - later scripts override earlier ones */
function mergeScriptsByTemplateId(
  scripts: TemplatizedScriptInsertion<unknown>[]
): TemplatizedScriptInsertion<unknown>[] {
  const byTemplateId = new Map<string, TemplatizedScriptInsertion<unknown>>();
  const nonTemplates: TemplatizedScriptInsertion<unknown>[] = [];

  for (const script of scripts) {
    if (script.type === "script-template") {
      byTemplateId.set(script.templateId, script);
    } else {
      nonTemplates.push(script);
    }
  }

  return [...byTemplateId.values(), ...nonTemplates];
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

  const dynamicScripts = scriptsRef.current;
  // Merge by templateId - dynamic scripts override initial (they have newer params)
  const allScripts = mergeScriptsByTemplateId([...initialScripts, ...dynamicScripts]);

  return (
    <>
      {allScripts.flatMap((script) => {
        if (script.type !== "script-template") return [];
        const template = templates[script.templateId];
        if (!template) {
          console.warn(`[Nextlytics] Template "${script.templateId}" not found`);
          return [];
        }
        // Use templateId as key - same template = same component instances
        return template.items.map((item, itemIndex) => (
          <InjectScript
            key={`${script.templateId}:${itemIndex}`}
            item={item}
            params={script.params}
            requestId={requestId}
          />
        ));
      })}
    </>
  );
}

type SendEventResult = {
  ok: boolean;
  scripts?: TemplatizedScriptInsertion<unknown>[];
};

async function sendEventToServer(
  requestId: string,
  request: ClientRequest,
  { signal }: { signal?: AbortSignal } = {}
): Promise<SendEventResult> {
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
        "[Nextlytics] In order for NextlyticsClient to work, you must mount nextlyticsRouteHandler to /api/event"
      );
      return { ok: false };
    }

    // Parse response to get scripts
    const data = await response.json().catch(() => ({ ok: response.ok }));
    return { ok: data.ok ?? response.ok, scripts: data.scripts };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false }; // Silently handle abort
    }
    console.error("[Nextlytics] Failed to send event:", error);
    return { ok: false };
  }
}

export function NextlyticsClient(props: { ctx: NextlyticsContext; children?: ReactNode }) {
  const { requestId, scripts: initialScripts = [], templates = {} } = props.ctx;

  // Track pathname for soft navigation detection
  const pathname = usePathname();
  const initialPathRef = useRef<string | null>(null);
  const lastPathRef = useRef<string | null>(null);

  // Refs for dynamic scripts (from sendEvent calls) - stable, no re-renders
  const scriptsRef = useRef<TemplatizedScriptInsertion<unknown>[]>([]);
  const subscribersRef = useRef<Set<() => void>>(new Set());

  const addScripts = useCallback((newScripts: TemplatizedScriptInsertion<unknown>[]) => {
    scriptsRef.current = [...scriptsRef.current, ...newScripts];
    subscribersRef.current.forEach((cb) => cb());
  }, []);

  // Context value is stable - refs don't change identity
  const contextValue = useMemo<NextlyticsContextValue>(
    () => ({ requestId, templates, addScripts, scriptsRef, subscribersRef }),
    [requestId, templates, addScripts]
  );

  // Send client-init on mount (once per requestId)
  useEffect(() => {
    initialPathRef.current = pathname;
    lastPathRef.current = pathname;
    const clientContext = createClientContext();
    sendEventToServer(requestId, { type: "client-init", clientContext }).then(({ scripts }) => {
      if (scripts?.length) addScripts(scripts);
    });
  }, [requestId, addScripts]); // pathname captured once on mount

  // Detect soft navigation and update event with client context
  useEffect(() => {
    // Skip if this is the initial render or same path
    if (initialPathRef.current === null || pathname === lastPathRef.current) {
      return;
    }
    lastPathRef.current = pathname;

    const controller = new AbortController();
    const clientContext = createClientContext();

    sendEventToServer(
      requestId,
      { type: "client-init", clientContext, softNavigation: true },
      { signal: controller.signal }
    ).then(({ scripts }) => {
      if (scripts?.length) addScripts(scripts);
    });

    return () => controller.abort();
  }, [pathname, requestId, addScripts]);

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

      if (result.scripts && result.scripts.length > 0) {
        addScripts(result.scripts);
      }

      return { ok: result.ok };
    },
    [requestId, addScripts]
  );

  return { sendEvent };
}
