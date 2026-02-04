const SENSITIVE_HEADERS = new Set(["cookie", "set-cookie", "authorization", "proxy-authorization"]);

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
