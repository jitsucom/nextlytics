/** Server-side request context collected in middleware */
export interface ServerEventContext {
  /** When the event was collected on server */
  collectedAt: Date;
  /** Request host (e.g. "example.com") */
  host: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** URL pathname (e.g. "/products/123") */
  path: string;
  /** Query parameters as key -> values[] */
  search: Record<string, string[]>;
  /** Client IP from x-forwarded-for or direct connection */
  ip: string;
  /** Request headers (sensitive ones removed) */
  requestHeaders: Record<string, string>;
  /** Response headers */
  responseHeaders: Record<string, string>;
}

/** Client-side context collected in browser */
export interface ClientContext {
  /** When the event was collected on client */
  collectedAt: Date;
  /** document.referrer */
  referer?: string;
  /** window.location.pathname - may differ from server path in SPAs */
  path?: string;
  /** window.location.href */
  url?: string;
  /** window.location.host */
  host?: string;
  /** window.location.search (as string, e.g. "?foo=bar") */
  search?: string;
  /** window.location.hash */
  hash?: string;
  /** document.title */
  title?: string;
  /** Screen and viewport dimensions */
  screen: {
    /** screen.width */
    width?: number;
    /** screen.height */
    height?: number;
    /** window.innerWidth (viewport) */
    innerWidth?: number;
    /** window.innerHeight (viewport) */
    innerHeight?: number;
    /** window.devicePixelRatio */
    density?: number;
  };
  /** navigator.userAgent */
  userAgent?: string;
  /** navigator.language */
  locale?: string;
}

/** Identified user context */
export interface UserContext {
  /** Unique user identifier */
  userId: string;
  /** User traits for identification */
  traits: {
    email?: string;
    name?: string;
    phone?: string;
  } & Record<string, unknown>;
}

/** Analytics event sent to backends */
export interface NextlyticsEvent {
  /**
   * Where the event was triggered?
   *  - server — on server, e.g in route or server side component
   *  - client — on client
   */
  origin: "server" | "client";

  /** ISO timestamp when event was collected */
  collectedAt: string;
  /** Unique event ID */
  eventId: string;
  /** Parent event ID (e.g. pageView for client events) */
  parentEventId?: string;
  /** Event type (e.g. "pageView", "apiCall", custom events) */
  type: "pageView" | "apiCall" | string;
  /** Anonymous user identifier (GDPR-compliant hash or cookie-based) */
  anonymousUserId?: string;
  /** Server-side request context */
  serverContext: ServerEventContext;
  /** Identified user context */
  userContext?: UserContext;
  /** Client-side browser context */
  clientContext?: ClientContext;
  /** Custom event properties */
  properties: Record<string, unknown>;
}

import type { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import type { NextMiddleware } from "next/server";

export type AnonymousUserResult = {
  /** Anonymous user identifier */
  anonId: string;
};

/** Headers and cookies context for backend/plugin factories. Uses Pick for compatibility with both
 * middleware (RequestCookies) and server components (ReadonlyRequestCookies) */
export type RequestContext = {
  headers: Headers;
  cookies: Pick<RequestCookies, "get" | "getAll" | "has">;
};

export type NextlyticsPlugin = {
  /**
   * Called right after event is created but before it's sent to backends.
   * Plugin can mutate the event to add/modify properties.
   * @param event - The event to process (can be mutated)
   */
  onDispatch(event: NextlyticsEvent): Promise<void>;
};

/** Factory to create plugin per-request (for request-scoped plugins) */
export type NextlyticsPluginFactory = (ctx: RequestContext) => NextlyticsPlugin;

/** When to deliver page view events for a backend */
export type PageViewDelivery =
  /** Dispatch on server request in middleware (default) - faster but no client context */
  | "on-request"
  /** Dispatch on page load (client-side) - has full client context (title, screen, etc) */
  | "on-page-load";

/** Backend with configuration options */
export type BackendWithConfig = {
  backend: NextlyticsBackend | NextlyticsBackendFactory;
  /** When to send events. Default: "on-request" */
  pageViewDelivery?: PageViewDelivery;
};

/** Backend config entry - either a backend directly or with config */
export type BackendConfigEntry = NextlyticsBackend | NextlyticsBackendFactory | BackendWithConfig;

export type NextlyticsConfig = {
  /** Enable debug logging (shows backend stats for each event) */
  debug?: boolean;
  anonymousUsers?: {
    /** Store anonymous ID in cookies */
    useCookies?: boolean;
    /** Use hash-based IDs for GDPR compliance (default: true) */
    gdprMode?: boolean;
    /** Rotate hash salt daily for shorter-lived IDs (default: true) */
    dailySalt?: boolean;
    /** Cookie name when useCookies=true (default: "__nextlytics_anon") */
    cookieName?: string;
    /** Cookie max age in seconds (default: 2 years) */
    cookieMaxAge?: number;
  };
  /** Skip tracking for API routes */
  excludeApiCalls?: boolean;
  /** Skip tracking for specific paths */
  excludePaths?: (path: string) => boolean;
  /** Determine if path is API route. Default: () => false */
  isApiPath?: (path: string) => boolean;
  /** Endpoint for client events. Default: "/api/event" */
  eventEndpoint?: string;
  callbacks: {
    /** Resolve authenticated user from request context */
    getUser?: (ctx: RequestContext) => Promise<UserContext | undefined>;
    /** Override anonymous user ID generation */
    getAnonymousUserId?: (opts: {
      ctx: RequestContext;
      originalAnonymousUserId?: string;
    }) => Promise<AnonymousUserResult>;
  };
  /** Analytics backends to send events to */
  backends?: BackendConfigEntry[];

  plugins?: (NextlyticsPlugin | NextlyticsPluginFactory)[];
};

export type ClientAction = {
  items: ClientActionItem[];
};

export type ClientActionItem = TemplatizedScriptInsertion<unknown>;

/**
 * Inserts scripts to a page as
 * `<script scr={src}></script>` or <script>{body}</script>
 */
export type TemplatizedScriptInsertion<T> = {
  type: "script-template";
  params: T;
  templateId: string;
};

/** Result of dispatching an event (two-phase) */
export type DispatchResult = {
  /** Resolves quickly with actions from backends with returnsClientActions=true */
  clientActions: Promise<ClientAction>;
  /** Resolves when ALL backends complete processing */
  completion: Promise<void>;
};

export type JavascriptTemplate = {
  items: ScriptElement[];
  /**
   * Optional dependency key template. When this value changes, the script re-injects.
   * If omitted, the template is treated as "once".
   */
  deps?: string | string[];
};

export type ScriptElement = {
  async?: boolean;
  //string[] means multiple lines, for convinience
  body?: string | string[];
  src?: string;
};

/** Backend that receives analytics events */
export type NextlyticsBackend = {
  /** Backend name for logging */
  name: string;
  /** Whether backend supports updating existing events */
  supportsUpdates?: boolean;
  /**
   * If onEvent can return client actions
   */
  returnsClientActions?: boolean;

  getClientSideTemplates?: () => Record<string, JavascriptTemplate>;

  /** Handle new event */
  onEvent(event: NextlyticsEvent): Promise<ClientAction | void | undefined>;
  /** Update existing event (e.g. add client context to server pageView) */
  updateEvent(eventId: string, patch: Partial<NextlyticsEvent>): Promise<void> | void;
};

/** Factory to create backend per-request (for request-scoped backends) */
export type NextlyticsBackendFactory = (ctx: RequestContext) => NextlyticsBackend;

/** Server-side analytics API */
export type NextlyticsServerSide = {
  /** Send custom event from server component/action */
  sendEvent: (
    eventName: string,
    opts?: { props?: Record<string, unknown> }
  ) => Promise<{ ok: boolean }>;
};

/** Context for Pages Router _app.tsx */
export type PagesRouterContext = {
  req: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> };
};

/** Context passed to NextlyticsClient */
export type NextlyticsClientContext = {
  requestId: string;
  scripts?: TemplatizedScriptInsertion<unknown>[];
  templates?: Record<string, JavascriptTemplate>;
};

/** Client-to-server request types (discriminated union) */
export type ClientRequest =
  | {
      type: "page-view";
      clientContext: ClientContext;
      /** If true, only update existing event (soft navigation - no dispatch, no scripts) */
      softNavigation?: boolean;
    }
  | {
      type: "custom-event";
      name: string;
      props?: Record<string, unknown>;
      collectedAt: string;
      clientContext: ClientContext;
    };

/**
 * Result of any /api/event call
 */
export type ClientRequestResult = {
  ok: boolean;
  items?: ClientActionItem[];
};

/** Return value from Nextlytics() */
export type NextlyticsResult = {
  /** Get server-side analytics API */
  analytics: () => Promise<NextlyticsServerSide>;
  /** Middleware to intercept requests */
  middleware: NextMiddleware;
  /** Manually dispatch event (returns two-phase result) */
  dispatchEvent: (event: NextlyticsEvent) => Promise<DispatchResult>;
  /** Manually update existing event */
  updateEvent: (eventId: string, patch: Partial<NextlyticsEvent>) => Promise<void>;
  /** Server component that wraps your app to provide analytics context (App Router) */
  NextlyticsServer: (props: { children: React.ReactNode }) => Promise<React.ReactElement>;
};
