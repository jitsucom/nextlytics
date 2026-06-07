import { describe, expect, it } from "vitest";
import { resolveCaptureType } from "./capture";

const browserNav = { isBrowserSubrequest: false, isDocumentRequest: true };
const nonBrowserGet = { isBrowserSubrequest: false, isDocumentRequest: false };
const subrequest = { isBrowserSubrequest: true, isDocumentRequest: false };

describe("resolveCaptureType", () => {
  it("maps capture() return values to an event type or skip", () => {
    expect(
      resolveCaptureType(() => true, nonBrowserGet, { path: "/docs/x.md", method: "GET" })
    ).toBe("pageView");
    expect(
      resolveCaptureType(() => false, nonBrowserGet, { path: "/docs/x.md", method: "GET" })
    ).toBeNull();
    expect(
      resolveCaptureType(() => "apiCall", nonBrowserGet, { path: "/api/x", method: "GET" })
    ).toBe("apiCall");
  });

  it("always skips browser sub-requests (RSC/XHR) before calling capture", () => {
    let called = false;
    const capture = () => {
      called = true;
      return true;
    };
    expect(
      resolveCaptureType(capture, subrequest, { path: "/anything", method: "GET" })
    ).toBeNull();
    expect(called).toBe(false);
  });

  it("skips non-GET requests that aren't document navigations (HEAD, webhook POST)", () => {
    let called = false;
    const capture = () => {
      called = true;
      return true;
    };
    expect(resolveCaptureType(capture, nonBrowserGet, { path: "/raw", method: "HEAD" })).toBeNull();
    expect(
      resolveCaptureType(capture, nonBrowserGet, { path: "/hook", method: "POST" })
    ).toBeNull();
    expect(called).toBe(false);
  });

  it("calls capture for a document navigation regardless of method (form POST)", () => {
    const seen: Array<{ fromBrowser: boolean; method: string }> = [];
    const capture = (r: { fromBrowser: boolean; method: string }) => {
      seen.push({ fromBrowser: r.fromBrowser, method: r.method });
      return true;
    };
    expect(resolveCaptureType(capture, browserNav, { path: "/submit", method: "POST" })).toBe(
      "pageView"
    );
    expect(seen).toEqual([{ fromBrowser: true, method: "POST" }]);
  });

  it("passes path, method, fromBrowser and userAgent through to capture", () => {
    let received: unknown;
    resolveCaptureType(
      (r) => {
        received = r;
        return false;
      },
      nonBrowserGet,
      { path: "/llms.txt", method: "GET", userAgent: "curl/8" }
    );
    expect(received).toEqual({
      path: "/llms.txt",
      method: "GET",
      fromBrowser: false,
      userAgent: "curl/8",
    });
  });
});
