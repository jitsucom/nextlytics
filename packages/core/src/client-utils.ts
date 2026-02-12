"use client";

import { memo, useEffect, useRef } from "react";

// Debug logging - enable via localStorage.setItem('nextlytics:debug', 'true')
const DEBUG_KEY = "nextlytics:debug";

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEBUG_KEY) === "true";
  } catch {
    return false;
  }
}

export const debug = (...args: unknown[]) => {
  if (!isDebugEnabled()) return;
  const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
  console.log(`[${timestamp}] [Nextlytics]`, ...args);
};

export type NavigationEvent = {
  softNavigation: boolean;
  signal?: AbortSignal;
};

// Try to get usePathname from next/navigation (App Router)
// Falls back to null for Pages Router where it doesn't exist
let usePathnameImpl: (() => string) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  usePathnameImpl = require("next/navigation").usePathname;
} catch {
  // Pages Router - usePathname not available
}

export function usePathnameSafe(): string | null {
  if (!usePathnameImpl) return null;
  return usePathnameImpl();
}

/**
 * Hook that detects page navigations and calls the callback once per navigation.
 *
 * - App Router: initial load = hard nav, subsequent pathname changes = soft nav
 * - Pages Router: every navigation changes requestId = always hard nav
 *
 * Provides an AbortSignal for soft navigations to cancel in-flight requests.
 */
export function useNavigation(
  requestId: string,
  onNavigate: (event: NavigationEvent) => void
): void {
  const pathname = usePathnameSafe();
  const stateRef = useRef<{ requestId: string; pathname: string | null } | null>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    const prev = stateRef.current;
    const isInitial = prev === null;
    const requestIdChanged = !isInitial && prev.requestId !== requestId;
    const pathnameChanged = !isInitial && pathname !== null && prev.pathname !== pathname;

    // Update state
    stateRef.current = { requestId, pathname };

    // Skip if nothing changed
    if (!isInitial && !requestIdChanged && !pathnameChanged) {
      return;
    }

    // Soft navigation: same requestId, different pathname (App Router only)
    const softNavigation = !isInitial && !requestIdChanged && pathnameChanged;

    debug("Navigation", {
      isInitial,
      softNavigation,
      requestId,
      pathname,
      requestIdChanged,
      pathnameChanged,
    });

    if (softNavigation) {
      const controller = new AbortController();
      onNavigateRef.current({ softNavigation: true, signal: controller.signal });
      return () => {
        debug("Aborting previous soft navigation request");
        controller.abort();
      };
    } else {
      onNavigateRef.current({ softNavigation: false });
    }
  }, [requestId, pathname]);
}

/** Props for the InjectScript utility component */
export type InjectScriptProps = {
  /** Inline script body (mutually exclusive with src) */
  body?: string;
  /** External script URL (mutually exclusive with body) */
  src?: string;
  /** Load external script async */
  async?: boolean;
  /** Dependencies that control re-injection. Empty/undefined = once, changes trigger re-injection */
  deps?: unknown[];
};

function arraysEqual(a?: unknown[], b?: unknown[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Pure utility component that injects a script into the document head.
 * Agnostic to templates, combining logic - just handles the injection lifecycle.
 */
export const InjectScript = memo(
  function InjectScript({ body, src, async: isAsync, deps = [] }: InjectScriptProps) {
    const depsKey = deps.map(String).join("\0");

    useEffect(() => {
      const el = document.createElement("script");
      if (src) {
        el.src = src;
        if (isAsync) el.async = true;
        debug("Inject external", { src, deps });
      } else if (body) {
        el.textContent = body;
        debug("Inject inline", { body: body.slice(0, 100), deps });
      }
      document.head.appendChild(el);

      return () => {
        debug("Remove script", { deps });
        el.remove();
      };
    }, [depsKey]);

    return null;
  },
  (prev, next) =>
    prev.body === next.body &&
    prev.src === next.src &&
    prev.async === next.async &&
    arraysEqual(prev.deps, next.deps)
);
