export type PathMatcherOptions = {
  /** Paths to exclude. Matches exact path or path prefix (with `/` boundary). */
  not?: string | string[];
  /** Allow partial matches — path can have fewer segments than pattern. */
  prefix?: boolean;
};

/**
 * Match a URL path against a Next.js-style `[param]` pattern.
 *
 * Returns extracted params on match, or `null` on mismatch.
 *
 * @example
 * ```ts
 * pathMatcher("/[workspace]/[project]", "/acme/myproject")
 * // => { workspace: "acme", project: "myproject" }
 * ```
 */
export function pathMatcher(
  pattern: string,
  path: string,
  opts?: PathMatcherOptions
): Record<string, string> | null {
  // Check exclusions first
  if (opts?.not) {
    const exclusions = Array.isArray(opts.not) ? opts.not : [opts.not];
    for (const excl of exclusions) {
      if (path === excl || path.startsWith(excl + "/")) {
        return null;
      }
    }
  }

  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);

  if (opts?.prefix) {
    // Prefix mode: path can have fewer segments (but not more), at least 1 required
    if (pathSegments.length === 0) return null;
    if (pathSegments.length > patternSegments.length) return null;
  } else {
    // Exact mode: segment counts must match
    if (pathSegments.length !== patternSegments.length) return null;
  }

  const params: Record<string, string> = {};
  const segmentsToMatch = Math.min(patternSegments.length, pathSegments.length);

  for (let i = 0; i < segmentsToMatch; i++) {
    const pat = patternSegments[i];
    const seg = pathSegments[i];

    const paramMatch = pat.match(/^\[(\w+)]$/);
    if (paramMatch) {
      params[paramMatch[1]] = decodeURIComponent(seg);
    } else if (pat !== seg) {
      return null;
    }
  }

  return params;
}
