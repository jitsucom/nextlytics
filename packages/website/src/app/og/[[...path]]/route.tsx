import { ImageResponse } from "next/og";
import { getIntegration } from "@/copy/integrations";
import { getArticle } from "@/copy/blog";

export const runtime = "edge";

const size = { width: 1200, height: 630 };

// Logo matching logo.tsx with clipPath to keep line inside circle
const NextlyticsLogo = ({ size: logoSize = 120 }: { size?: number }) => (
  <svg width={logoSize} height={logoSize} viewBox="0 0 40 40" fill="none">
    <defs>
      <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
      <clipPath id="circle-clip">
        <circle cx="20" cy="20" r="18" />
      </clipPath>
    </defs>
    <circle cx="20" cy="20" r="18" fill="url(#logo-gradient)" />
    <path
      d="M2 20H8L12 10L28 30L32 20H38"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      clipPath="url(#circle-clip)"
    />
  </svg>
);

function MainOGImage() {
  return (
    <div
      style={{
        background: "#FAFAFA",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", marginBottom: 40 }}>
        <NextlyticsLogo size={120} />
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 700,
          color: "#18181B",
          marginBottom: 20,
          letterSpacing: "-0.02em",
        }}
      >
        nextlytics
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: "#71717A",
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        Next.js Native Open-Source Analytics
      </div>
      <div
        style={{
          display: "flex",
          gap: 40,
          marginTop: 50,
          fontSize: 24,
          color: "#A1A1AA",
        }}
      >
        <span>100% Server-Side</span>
        <span>•</span>
        <span>No Cookies</span>
        <span>•</span>
        <span>GDPR Compliant</span>
      </div>
    </div>
  );
}

function ArticleOGImage({ title, readTime }: { title: string; readTime: number }) {
  return (
    <div
      style={{
        background: "#FAFAFA",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", marginBottom: 40 }}>
        <NextlyticsLogo size={80} />
      </div>
      <div
        style={{
          display: "flex",
          background: "#F4F4F5",
          color: "#52525B",
          padding: "8px 20px",
          borderRadius: 20,
          fontSize: 18,
          fontWeight: 500,
          marginBottom: 24,
        }}
      >
        {readTime} min read
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 56,
          fontWeight: 700,
          color: "#18181B",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 900,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 50,
          fontSize: 24,
          color: "#A1A1AA",
        }}
      >
        nextlytics.dev/blog
      </div>
    </div>
  );
}

function IntegrationOGImage({
  name,
  description,
  typeLabel,
  modeLabel,
  logoSvg,
}: {
  name: string;
  description: string;
  typeLabel: string;
  modeLabel: string;
  logoSvg?: string;
}) {
  return (
    <div
      style={{
        background: "#FAFAFA",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Centered logos */}
      <div style={{ display: "flex", alignItems: "center", gap: 32, marginBottom: 40 }}>
        <NextlyticsLogo size={100} />
        <div
          style={{
            display: "flex",
            fontSize: 48,
            color: "#D4D4D8",
            fontWeight: 300,
          }}
        >
          +
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 100,
            height: 100,
          }}
        >
          {logoSvg ? (
            <img
              src={`data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`}
              width={80}
              height={80}
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 80,
                height: 80,
                background: "#E4E4E7",
                borderRadius: 16,
              }}
            />
          )}
        </div>
      </div>

      {/* Integration name */}
      <div
        style={{
          display: "flex",
          fontSize: 48,
          fontWeight: 700,
          color: "#18181B",
          marginBottom: 16,
          letterSpacing: "-0.02em",
        }}
      >
        Nextlytics for {name}
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <span
          style={{
            display: "flex",
            background: typeLabel === "Backend" ? "#DBEAFE" : "#F3E8FF",
            color: typeLabel === "Backend" ? "#1D4ED8" : "#7C3AED",
            padding: "8px 20px",
            borderRadius: 20,
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          {typeLabel}
        </span>
        <span
          style={{
            display: "flex",
            background: "#F4F4F5",
            color: "#52525B",
            padding: "8px 20px",
            borderRadius: 20,
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          {modeLabel}
        </span>
      </div>

      {/* Description */}
      <div
        style={{
          display: "flex",
          fontSize: 24,
          color: "#71717A",
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: 800,
        }}
      >
        {description}
      </div>
    </div>
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;

  // /og/ - main OG image
  if (!path || path.length === 0) {
    return new ImageResponse(<MainOGImage />, { ...size });
  }

  // /og/blog/[slug] - blog article OG image
  if (path[0] === "blog" && path[1]) {
    const slug = path[1];
    const article = getArticle(slug);

    if (!article) {
      return new ImageResponse(<MainOGImage />, { ...size });
    }

    return new ImageResponse(<ArticleOGImage title={article.title} readTime={article.readTime} />, {
      ...size,
    });
  }

  // /og/integrations/[slug] - integration OG image
  if (path[0] === "integrations" && path[1]) {
    const slug = path[1];
    const integration = getIntegration(slug);

    if (!integration) {
      return new ImageResponse(<MainOGImage />, { ...size });
    }

    const typeLabel = integration.type === "backend" ? "Backend" : "Plugin";
    const isHybrid = integration.tags.includes("hybrid");
    const isServerSide = integration.tags.includes("server-side");
    const modeLabel = isHybrid ? "Hybrid" : isServerSide ? "Server-side" : "Client-side";

    return new ImageResponse(
      <IntegrationOGImage
        name={integration.name}
        description={integration.description}
        typeLabel={typeLabel}
        modeLabel={modeLabel}
        logoSvg={integration.logoSvg}
      />,
      { ...size }
    );
  }

  // Fallback to main
  return new ImageResponse(<MainOGImage />, { ...size });
}
