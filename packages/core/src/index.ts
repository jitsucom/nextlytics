export { Nextlytics } from "./server";
export { getNextlyticsProps } from "./pages-router";
export { NextlyticsClient, useNextlytics, type NextlyticsContext } from "./client";
export { loggingBackend } from "./backends/logging";
export { pathMatcher, type PathMatcherOptions } from "./path-matcher";
export type {
  NextlyticsConfig,
  NextlyticsResult,
  NextlyticsEvent,
  NextlyticsBackend,
  NextlyticsBackendFactory,
  NextlyticsPlugin,
  NextlyticsPluginFactory,
  NextlyticsServerSide,
  ServerEventContext,
  ClientContext,
  ClientRequest,
  UserContext,
  RequestContext,
  AnonymousUserResult,
  BackendConfigEntry,
  BackendWithConfig,
  PageViewDelivery,
  JavascriptTemplate,
  ClientAction,
  PagesRouterContext,
  NextlyticsClientContext,
} from "./types";
