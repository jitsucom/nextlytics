import type { NextResponse } from "next/server";
import type {
  AnonymousUserResult,
  NextlyticsConfig,
  RequestContext,
  ServerEventContext,
} from "./types";

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ANON_ID_LENGTH = 10; // 62^10 ≈ 8.4 × 10^17 combinations

// Defaults for anonymous user config
const DEFAULTS = {
  gdprMode: true,
  useCookies: false,
  dailySalt: true,
  cookieName: "__nextlytics_anon",
  cookieMaxAge: 60 * 60 * 24 * 365 * 2, // 2 years
} as const;

/**
 * Check if the request is over HTTPS using headers.
 */
function isSecureRequest(headers: RequestContext["headers"]): boolean {
  const proto = headers.get("x-forwarded-proto");
  if (proto) return proto === "https";
  return false;
}

/**
 * Get the current daily salt for GDPR-compliant hashing.
 * Rotates at midnight UTC.
 */
function getDailySalt(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
}

/**
 * Convert bytes to base62 string.
 */
function bytesToBase62(bytes: Uint8Array, length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    // Use pairs of bytes for better distribution
    const idx = (bytes[i * 2] * 256 + bytes[i * 2 + 1]) % 62;
    result += BASE62_CHARS[idx];
  }
  return result;
}

/**
 * Hash a string using SHA-256 and return base62-encoded short ID.
 */
async function hashToShortId(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase62(new Uint8Array(hashBuffer), ANON_ID_LENGTH);
}

/**
 * Generate GDPR-compliant anonymous user ID.
 * Uses Fathom-like approach: hash(dailySalt + IP + UserAgent + host)
 * This creates a daily-unique identifier that can't be reversed to PII.
 */
async function generateGdprAnonId(
  serverContext: ServerEventContext,
  useDailySalt: boolean
): Promise<string> {
  const ip = serverContext.ip || "unknown";
  const userAgent = serverContext.requestHeaders["user-agent"] || "unknown";
  const host = serverContext.host || "unknown";

  const parts = useDailySalt ? [getDailySalt(), ip, userAgent, host] : [ip, userAgent, host];

  return hashToShortId(parts.join("|"));
}

/**
 * Generate a random anonymous user ID (non-GDPR mode with cookies).
 */
function generateRandomAnonId(): string {
  const bytes = new Uint8Array(ANON_ID_LENGTH * 2);
  crypto.getRandomValues(bytes);
  return bytesToBase62(bytes, ANON_ID_LENGTH);
}

export type ResolveAnonymousUserParams = {
  ctx: RequestContext;
  serverContext: ServerEventContext;
  config: NextlyticsConfig;
  /** Optional response for setting cookies. If not provided, cookies won't be set. */
  response?: NextResponse | null;
};

/**
 * Resolve anonymous user ID based on config.
 *
 * Modes:
 * - gdprMode=true (default): Hash-based ID (Fathom-like)
 * - gdprMode=false + useCookies=true: Persistent cookie-based ID
 * - gdprMode=false + useCookies=false: Random ID per request
 */
export async function resolveAnonymousUser(
  params: ResolveAnonymousUserParams
): Promise<AnonymousUserResult> {
  const { ctx, serverContext, config, response } = params;
  const { headers, cookies } = ctx;

  // Apply defaults
  const gdprMode = config.anonymousUsers?.gdprMode ?? DEFAULTS.gdprMode;
  const useCookies = config.anonymousUsers?.useCookies ?? DEFAULTS.useCookies;
  const dailySalt = config.anonymousUsers?.dailySalt ?? DEFAULTS.dailySalt;
  const cookieName = config.anonymousUsers?.cookieName ?? DEFAULTS.cookieName;
  const cookieMaxAge = config.anonymousUsers?.cookieMaxAge ?? DEFAULTS.cookieMaxAge;

  let anonId: string;
  let shouldSetCookie = false;

  // Check for existing cookie first (only if useCookies is enabled)
  if (useCookies) {
    const existingCookie = cookies.get(cookieName);
    if (existingCookie?.value) {
      anonId = existingCookie.value;
    } else {
      // Generate new ID and mark for cookie
      anonId = gdprMode
        ? await generateGdprAnonId(serverContext, dailySalt)
        : generateRandomAnonId();
      shouldSetCookie = true;
    }
  } else {
    // No cookies - generate ID based on mode
    if (gdprMode) {
      // GDPR mode: deterministic hash-based ID (same user = same ID within a day if dailySalt=true)
      anonId = await generateGdprAnonId(serverContext, dailySalt);
    } else {
      // Non-GDPR, no cookies: random ID per request (limited usefulness)
      anonId = generateRandomAnonId();
    }
  }

  // Allow user override via callback
  if (config.callbacks?.getAnonymousUserId) {
    try {
      const overrideResult = await config.callbacks.getAnonymousUserId({
        ctx,
        originalAnonymousUserId: anonId,
      });
      anonId = overrideResult.anonId;
    } catch {
      // Fallback to generated ID on error
    }
  }

  // Set cookie if needed and response is available
  if (shouldSetCookie && response) {
    response.cookies.set(cookieName, anonId, {
      maxAge: cookieMaxAge,
      httpOnly: true,
      secure: isSecureRequest(headers),
      sameSite: "lax",
      path: "/",
    });
  }

  return { anonId };
}
