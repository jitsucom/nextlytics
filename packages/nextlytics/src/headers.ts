export const headers = {
  // Request pathname set by middleware (e.g. "/test", "/api/users")
  pathname: "x-nc-pathname",
  // Query string set by middleware (e.g. "?foo=bar")
  search: "x-nc-search",
  // Unique page render ID
  pageRenderId: "x-page-render-id",
  // Script template params: templateId=params;templateId2=params2
  scripts: "x-nc-scripts",
} as const;

const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
  "x-csrf-token",
  "x-xsrf-token",
]);

const SENSITIVE_PATTERNS = /auth|token|key|secret|password|credential|session/i;

export function removeSensitiveHeaders(
  requestHeaders: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(requestHeaders)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lowerKey) || SENSITIVE_PATTERNS.test(lowerKey)) {
      result[key] = `[redacted, len ${value.length}]`;
    } else {
      result[key] = value;
    }
  }

  return result;
}
