// A non-API route handler that serves plain text to non-browser clients.
// Used by the e2e suite to assert that direct, non-navigation GETs (the kind
// agents/curl make for .md / .txt content) are tracked as pageViews by the
// middleware — not just browser page navigations.
export function GET() {
  return new Response("raw data payload", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
