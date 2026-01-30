import { ImageResponse } from "next/og";
import { getIntegration } from "@/copy/integrations";

export const runtime = "edge";
export const alt = "Nextlytics Integration";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const integration = getIntegration(slug);

  if (!integration) {
    return new ImageResponse(
      <div
        style={{
          background: "#7C3AED",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 48,
        }}
      >
        Integration Not Found
      </div>,
      { ...size }
    );
  }

  const typeLabel = integration.type === "backend" ? "Backend" : "Plugin";
  const isHybrid = integration.tags.includes("hybrid");
  const isServerSide = integration.tags.includes("server-side");
  const modeLabel = isHybrid ? "Hybrid" : isServerSide ? "Server-side" : "Client-side";

  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 60,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Top: Nextlytics branding */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" fill="rgba(255,255,255,0.2)" />
          <path
            d="M2 20H8L12 10L28 30L32 20H38"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
          nextlytics
        </span>
      </div>

      {/* Center: Integration info */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        {/* Badges */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <span
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "white",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 20,
              fontWeight: 500,
            }}
          >
            {typeLabel}
          </span>
          <span
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "white",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 20,
              fontWeight: 500,
            }}
          >
            {modeLabel}
          </span>
        </div>

        {/* Integration name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "white",
            marginBottom: 20,
            letterSpacing: "-0.02em",
          }}
        >
          {integration.name}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          {integration.description}
        </div>
      </div>

      {/* Bottom: URL */}
      <div style={{ fontSize: 22, color: "rgba(255,255,255,0.6)" }}>
        nextlytics.dev/integrations/{slug}
      </div>
    </div>,
    { ...size }
  );
}
