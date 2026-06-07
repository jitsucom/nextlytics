import type { CaptureRequest } from "./types";

/** The mechanical request facts the capture decision needs. */
type CaptureReqInfo = {
  /** Browser-initiated sub-request (RSC/XHR/fetch/subresource). */
  isBrowserSubrequest: boolean;
  /** Hard document navigation (Sec-Fetch-Dest: document / mode: navigate). */
  isDocumentRequest: boolean;
};

/**
 * Resolve the event type for a request under `capture` configuration, or `null`
 * to skip. Pure and side-effect free so it can be unit-tested directly.
 *
 * Mechanical noise is filtered first regardless of what `capture` returns:
 *  - browser sub-requests (RSC soft-nav / XHR / fetch / subresource) — would
 *    duplicate the client-side pageView, so never recorded here;
 *  - non-GET requests that aren't document navigations (HEAD probes, webhook
 *    POSTs, etc.) — not page views.
 *
 * Everything else — a real browser navigation, or a direct GET from a
 * non-browser client — is handed to `capture`, whose return decides:
 *  `false` → skip, `true` → "pageView", `"<type>"` → that event type.
 */
export function resolveCaptureType(
  capture: (req: CaptureRequest) => boolean | string,
  reqInfo: CaptureReqInfo,
  req: { path: string; method: string; userAgent?: string }
): string | null {
  if (reqInfo.isBrowserSubrequest) return null;
  if (req.method !== "GET" && !reqInfo.isDocumentRequest) return null;

  const result = capture({
    path: req.path,
    method: req.method,
    fromBrowser: reqInfo.isDocumentRequest,
    userAgent: req.userAgent,
  });

  if (result === false) return null;
  return result === true ? "pageView" : result;
}
