import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import type { NextlyticsConfigWithDefaults } from "./config-helpers";
import type { AnonymousUserResult, ServerEventContext } from "./types";

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ANON_ID_LENGTH = 10; // 62^10 ≈ 8.4 × 10^17 combinations

/**
 * Check if the request is over HTTPS using headers or URL.
 */
function isSecureRequest(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto === "https";
  return request.url.startsWith("https:");
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

/**
 * Resolve anonymous user ID based on config.
 *
 * Modes:
 * - gdprMode=true (default): Hash-based ID (Fathom-like)
 * - gdprMode=false + useCookies=true: Persistent cookie-based ID
 * - gdprMode=false + useCookies=false: Random ID per request
 *
 * @param response - Pass response to set cookie (null for POST handlers where cookie was already set)
 */
export async function resolveAnonymousUser(
  request: NextRequest,
  response: NextResponse | null,
  serverContext: ServerEventContext,
  config: NextlyticsConfigWithDefaults
): Promise<AnonymousUserResult> {
  const { anonymousUsers, callbacks } = config;
  const { gdprMode, useCookies, dailySalt, cookieName, cookieMaxAge } = anonymousUsers;

  let anonId: string;
  let shouldSetCookie = false;

  // Check for existing cookie first (only if useCookies is enabled)
  if (useCookies) {
    const existingCookie = request.cookies.get(cookieName);
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
  if (callbacks.getAnonymousUserId) {
    try {
      const overrideResult = await callbacks.getAnonymousUserId({
        request,
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
      secure: isSecureRequest(request),
      sameSite: "lax",
      path: "/",
    });
  }

  return { anonId };
}
