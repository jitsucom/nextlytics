import "./globals.css";
import { NextlyticsServer } from "@/nextlytics";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7C3AED",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://nextlytics.dev"),
  title: {
    default: "Nextlytics - Next.js Native Open-Source Analytics",
    template: "%s | Nextlytics",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  description:
    "100% server-side analytics for Next.js. No client JS, no cookies, GDPR compliant. " +
    "Works with Posthog, Google Analytics, Segment, or your own database.",
  keywords: [
    "Next.js analytics",
    "server-side analytics",
    "GDPR compliant analytics",
    "privacy-first analytics",
    "no cookies analytics",
    "Posthog",
    "Google Analytics",
    "open source analytics",
  ],
  authors: [{ name: "Jitsu", url: "https://jitsu.com" }],
  creator: "Jitsu",
  publisher: "Jitsu",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://nextlytics.dev",
    siteName: "Nextlytics",
    title: "Nextlytics - Next.js Native Open-Source Analytics",
    description:
      "100% server-side analytics for Next.js. No client JS, no cookies, GDPR compliant.",
    images: [{ url: "https://nextlytics.dev/og", width: 1200, height: 630, alt: "Nextlytics" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nextlytics - Next.js Native Open-Source Analytics",
    description:
      "100% server-side analytics for Next.js. No client JS, no cookies, GDPR compliant.",
    creator: "@jaborjitsu",
    images: ["https://nextlytics.dev/og"],
  },
  alternates: {
    canonical: "https://nextlytics.dev",
  },
  category: "technology",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://nextlytics.dev/#organization",
      name: "Nextlytics",
      url: "https://nextlytics.dev",
      logo: "https://nextlytics.dev/icon.svg",
      sameAs: ["https://github.com/jitsucom/nextlytics"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://nextlytics.dev/#software",
      name: "Nextlytics",
      description:
        "100% server-side analytics for Next.js. No client JS, no cookies, GDPR compliant.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      author: {
        "@type": "Organization",
        name: "Jitsu",
        url: "https://jitsu.com",
      },
      license: "https://opensource.org/licenses/MIT",
      programmingLanguage: "TypeScript",
    },
    {
      "@type": "WebSite",
      "@id": "https://nextlytics.dev/#website",
      url: "https://nextlytics.dev",
      name: "Nextlytics",
      publisher: { "@id": "https://nextlytics.dev/#organization" },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-white text-zinc-900 antialiased">
        <NextlyticsServer>{children}</NextlyticsServer>
      </body>
    </html>
  );
}
