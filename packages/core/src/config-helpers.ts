import type { NextlyticsConfig } from "./types";

export type NextlyticsConfigWithDefaults = Required<
  Pick<NextlyticsConfig, "excludeApiCalls" | "eventEndpoint" | "isApiPath" | "backends">
> &
  NextlyticsConfig & {
    anonymousUsers: Required<NonNullable<NextlyticsConfig["anonymousUsers"]>>;
  };

export function withDefaults(config: NextlyticsConfig): NextlyticsConfigWithDefaults {
  return {
    ...config,
    excludeApiCalls: config.excludeApiCalls ?? false,
    eventEndpoint: config.eventEndpoint ?? "/api/event",
    isApiPath: config.isApiPath ?? ((str: string) => str.startsWith("/api")),
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

export function validateConfig(_config: NextlyticsConfig): ConfigValidationResult {
  // Currently no validations - can add backend-specific checks here
  return { valid: true, warnings: [] };
}

export function logConfigWarnings(result: ConfigValidationResult): void {
  for (const warning of result.warnings) {
    console.warn(warning);
  }
}
