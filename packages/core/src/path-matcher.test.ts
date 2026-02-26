import { describe, expect, it } from "vitest";
import { pathMatcher } from "./path-matcher";

describe("pathMatcher", () => {
  describe("basic matching", () => {
    it("extracts a single param", () => {
      expect(pathMatcher("/[workspace]", "/acme")).toEqual({ workspace: "acme" });
    });

    it("extracts multiple params", () => {
      expect(pathMatcher("/[workspace]/[project]", "/acme/myproject")).toEqual({
        workspace: "acme",
        project: "myproject",
      });
    });

    it("matches literal segments", () => {
      expect(pathMatcher("/app/settings", "/app/settings")).toEqual({});
    });

    it("returns null on literal mismatch", () => {
      expect(pathMatcher("/app/settings", "/app/profile")).toBeNull();
    });

    it("returns null on segment count mismatch (too few)", () => {
      expect(pathMatcher("/[a]/[b]/[c]", "/x/y")).toBeNull();
    });

    it("returns null on segment count mismatch (too many)", () => {
      expect(pathMatcher("/[a]/[b]", "/x/y/z")).toBeNull();
    });

    it("matches root path against empty pattern", () => {
      expect(pathMatcher("/", "/")).toEqual({});
    });

    it("handles trailing slashes", () => {
      expect(pathMatcher("/[workspace]/", "/acme/")).toEqual({ workspace: "acme" });
    });

    it("decodes URL-encoded values", () => {
      expect(pathMatcher("/[name]", "/hello%20world")).toEqual({ name: "hello world" });
    });

    it("mixes literal and param segments", () => {
      expect(pathMatcher("/app/[workspace]/settings", "/app/acme/settings")).toEqual({
        workspace: "acme",
      });
    });

    it("returns null when literal segment in the middle mismatches", () => {
      expect(pathMatcher("/app/[workspace]/settings", "/app/acme/profile")).toBeNull();
    });
  });

  describe("prefix mode", () => {
    it("matches with fewer segments", () => {
      expect(pathMatcher("/[workspace]/[project]/[taskId]", "/acme", { prefix: true })).toEqual({
        workspace: "acme",
      });
    });

    it("matches partial prefix", () => {
      expect(
        pathMatcher("/[workspace]/[project]/[taskId]", "/acme/myproject", { prefix: true })
      ).toEqual({
        workspace: "acme",
        project: "myproject",
      });
    });

    it("matches full pattern in prefix mode", () => {
      expect(pathMatcher("/[workspace]/[project]", "/acme/myproject", { prefix: true })).toEqual({
        workspace: "acme",
        project: "myproject",
      });
    });

    it("returns null when path has more segments than pattern", () => {
      expect(pathMatcher("/[workspace]", "/acme/extra/stuff", { prefix: true })).toBeNull();
    });

    it("returns null for root path against non-empty pattern", () => {
      expect(pathMatcher("/[workspace]", "/", { prefix: true })).toBeNull();
    });

    it("validates literal segments in prefix mode", () => {
      expect(pathMatcher("/app/[workspace]", "/wrong/acme", { prefix: true })).toBeNull();
    });

    it("matches literal-only prefix", () => {
      expect(pathMatcher("/app/settings", "/app", { prefix: true })).toEqual({});
    });
  });

  describe("not option", () => {
    it("excludes exact path", () => {
      expect(pathMatcher("/[page]", "/auth", { not: "/auth" })).toBeNull();
    });

    it("excludes path prefix", () => {
      expect(pathMatcher("/[page]/[sub]", "/auth/login", { not: "/auth" })).toBeNull();
    });

    it("does not do partial string match", () => {
      // "/auth" should NOT exclude "/authentication"
      expect(pathMatcher("/[page]", "/authentication", { not: "/auth" })).toEqual({
        page: "authentication",
      });
    });

    it("supports array of exclusions", () => {
      expect(pathMatcher("/[page]", "/admin", { not: ["/auth", "/admin"] })).toBeNull();
      expect(pathMatcher("/[page]", "/auth", { not: ["/auth", "/admin"] })).toBeNull();
      expect(pathMatcher("/[page]", "/home", { not: ["/auth", "/admin"] })).toEqual({
        page: "home",
      });
    });

    it("works combined with prefix mode", () => {
      expect(
        pathMatcher("/[workspace]/[project]", "/auth/login", { not: "/auth", prefix: true })
      ).toBeNull();
      expect(
        pathMatcher("/[workspace]/[project]", "/acme", { not: "/auth", prefix: true })
      ).toEqual({ workspace: "acme" });
    });
  });
});
