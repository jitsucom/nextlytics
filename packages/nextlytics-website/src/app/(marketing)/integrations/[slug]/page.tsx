import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { Server, Monitor, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { PageHeader } from "@/components/page-header";
import { getIntegration, integrations, type IntegrationTag } from "@/copy/integrations";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return integrations.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const integration = getIntegration(slug);
  if (!integration) return {};

  const typeLabel = integration.type === "backend" ? "Backend" : "Plugin";
  const title = `${integration.name} ${typeLabel} for Nextlytics`;
  const url = `https://nextlytics.dev/integrations/${slug}`;

  return {
    title,
    description: integration.description,
    keywords: [
      integration.name,
      `${integration.name} analytics`,
      `Nextlytics ${integration.name}`,
      "server-side analytics",
      "Next.js analytics",
      integration.type === "backend" ? "analytics backend" : "analytics plugin",
    ],
    openGraph: {
      type: "article",
      title,
      description: integration.description,
      url,
      images: [
        {
          url: `https://nextlytics.dev/og/integrations/${slug}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: integration.description,
      images: [`https://nextlytics.dev/og/integrations/${slug}`],
    },
    alternates: {
      canonical: url,
    },
  };
}

const typeColors = {
  backend: "bg-blue-100 text-blue-700",
  plugin: "bg-purple-100 text-purple-700",
} as const;

const tagConfig: Record<
  IntegrationTag,
  { label: string; color: string; dot?: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  stable: { label: "Stable", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  beta: { label: "Beta", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  "coming-soon": { label: "Coming Soon", color: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-400" },
  "client-side": { label: "Client-side", color: "bg-sky-100 text-sky-700", icon: Monitor },
  "server-side": { label: "Server-side", color: "bg-indigo-100 text-indigo-700", icon: Server },
  hybrid: { label: "Hybrid", color: "bg-violet-100 text-violet-700", icon: RefreshCw },
} as const;

export default async function IntegrationPage({ params }: Props) {
  const { slug } = await params;
  const integration = getIntegration(slug);

  if (!integration) {
    notFound();
  }

  // Read documentation
  let documentation = "";
  try {
    const docPath = path.join(process.cwd(), "src/copy/integrations", slug, "documentation.mdx");
    documentation = await fs.readFile(docPath, "utf-8");
  } catch {
    documentation = "Documentation coming soon.";
  }

  const typeLabel = integration.type === "backend" ? "Backend" : "Plugin";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${integration.name} ${typeLabel} for Nextlytics`,
    description: integration.description,
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
    isPartOf: {
      "@type": "SoftwareApplication",
      name: "Nextlytics",
      url: "https://nextlytics.dev",
    },
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHeader
        variant="hero"
        breadcrumbs={[
          { label: "Nextlytics", href: "/" },
          { label: "Integrations", href: "/integrations" },
        ]}
        title={integration.name}
      >
        {/* Logo + metadata */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-border flex items-center
                            justify-center shrink-0 shadow-sm"
          >
            <Image
              src={integration.logo}
              alt={integration.logoAlt || integration.name}
              width={40}
              height={40}
              className="object-contain w-8 h-8 sm:w-10 sm:h-10"
            />
          </div>
          <div className="flex-1 min-w-0">
            {/* Type + tags */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-block px-2.5 py-1 rounded text-xs font-medium capitalize
                                    ${typeColors[integration.type]}`}
              >
                {typeLabel}
              </span>
              {integration.tags.map((tag) => {
                const config = tagConfig[tag];
                const Icon = config.icon;
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded
                                            text-xs font-medium ${config.color}`}
                  >
                    {config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
                    {Icon && <Icon className="w-3 h-3" />}
                    {config.label}
                  </span>
                );
              })}
            </div>
            <p className="text-sm sm:text-base text-foreground/80">{integration.description}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/#how-it-works">Get Started</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/demo">View Demo</Link>
          </Button>
        </div>
      </PageHeader>

      {/* Context banner */}
      <section className="border-b border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Nextlytics</span> is a server-side
            analytics library for Next.js. No client JavaScript, no cookies, GDPR compliant.{" "}
            <Link href="/" className="text-violet-600 hover:underline">
              Learn more →
            </Link>
          </p>
        </div>
      </section>

      {/* Documentation */}
      <section className="py-8 sm:py-12">
        <div className="max-w-5xl mx-auto px-6">
          <MarkdownContent content={documentation} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-8 sm:py-12 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-lg sm:text-xl font-bold mb-2">Ready to add server-side analytics?</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            Get started with Nextlytics in 3 simple steps.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/#how-it-works">Get Started</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/demo">View Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
