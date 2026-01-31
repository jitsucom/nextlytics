import type { NextlyticsConfig } from "./types";

export type NextlyticsConfigWithDefaults = Required<
  Pick<
    NextlyticsConfig,
    "pageViewMode" | "excludeApiCalls" | "eventEndpoint" | "isApiPath" | "backends"
  >
> &
  NextlyticsConfig & {
    anonymousUsers: Required<NonNullable<NextlyticsConfig["anonymousUsers"]>>;
  };

export function withDefaults(config: NextlyticsConfig): NextlyticsConfigWithDefaults {
  return {
    ...config,
    pageViewMode: config.pageViewMode ?? "server",
    excludeApiCalls: config.excludeApiCalls ?? false,
    eventEndpoint: config.eventEndpoint ?? "/api/event",
    isApiPath: config.isApiPath ?? (() => false),
    backends: config.backends ?? [],
    anonymousUsers: {
      gdprMode: config.anonymousUsers?.gdprMode ?? true,
      useCookies: config.anonymousUsers?.useCookies ?? false,
      dailySalt: config.anonymousUsers?.dailySalt ?? true,
      cookieName: config.anonymousUsers?.cookieName ?? "__nextlytics_anon",
      cookieMaxAge: config.anonymousUsers?.cookieMaxAge ?? 60 * 60 * 24 * 365 * 2, // 2 years
    },
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  warnings: string[];
}

export function validateConfig(config: NextlyticsConfig): ConfigValidationResult {
  const warnings: string[] = [];

  if (config.pageViewMode === "client-init" && config.backends?.length) {
    // Only check non-factory backends (factories are resolved at runtime)
    const staticBackends = config.backends.filter((b) => typeof b !== "function");
    const backendsWithoutUpdates = staticBackends.filter((b) => !b.supportsUpdates);

    if (backendsWithoutUpdates.length > 0) {
      const backendNames = backendsWithoutUpdates.map((b) => `"${b.name}"`).join(", ");
      warnings.push(
        `[Nextlytics] pageViewMode="client-init" requires backends that support updates. ` +
          `These don't: ${backendNames}`
      );
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export function logConfigWarnings(result: ConfigValidationResult): void {
  for (const warning of result.warnings) {
    console.warn(warning);
  }
}
