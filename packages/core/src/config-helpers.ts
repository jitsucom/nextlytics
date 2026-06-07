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

export function validateConfig(config: NextlyticsConfig): ConfigValidationResult {
  const warnings: string[] = [];

  const deprecated = (["isApiPath", "excludeApiCalls", "excludePaths"] as const).filter(
    (k) => config[k] !== undefined
  );

  if (config.capture && deprecated.length > 0) {
    warnings.push(
      `[Nextlytics] \`capture\` is set, so the deprecated option(s) ${deprecated.join(", ")} are ignored. Move that logic into \`capture\`.`
    );
  } else if (deprecated.length > 0) {
    warnings.push(
      `[Nextlytics] ${deprecated.join(", ")} are deprecated; prefer \`capture\` (return false / true / "<eventType>").`
    );
  }

  return { valid: true, warnings };
}

export function logConfigWarnings(result: ConfigValidationResult): void {
  for (const warning of result.warnings) {
    console.warn(warning);
  }
}
