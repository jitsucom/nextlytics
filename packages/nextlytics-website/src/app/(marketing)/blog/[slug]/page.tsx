import { notFound } from "next/navigation";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import { Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { PageHeader } from "@/components/page-header";
import { getArticle, getArticleComponents, articles } from "@/copy/blog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  const title = `${article.title} | Nextlytics`;
  const url = `https://nextlytics.dev/blog/${slug}`;

  return {
    title,
    description: article.description,
    openGraph: {
      type: "article",
      title,
      description: article.description,
      url,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: article.description,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  // Read article content
  let content = "";
  try {
    const contentPath = path.join(process.cwd(), "src/copy/blog", slug, "content.mdx");
    content = await fs.readFile(contentPath, "utf-8");
  } catch {
    content = "Content coming soon.";
  }

  const date = new Date(article.publishedAt);
  const formattedDate = date
    .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    .replace(/ /g, "\u00A0"); // non-breaking spaces

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      "@type": "Organization",
      name: "Nextlytics",
      url: "https://nextlytics.dev",
    },
    publisher: {
      "@type": "Organization",
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
          { label: "Blog", href: "/blog" },
        ]}
        title={article.title}
        description={article.description}
      >
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {formattedDate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {article.readTime}&nbsp;min read
          </span>
        </div>
      </PageHeader>

      {/* Article content */}
      <section className="py-8 sm:py-12">
        <div className="max-w-5xl mx-auto px-6">
          <MarkdownContent content={content} components={getArticleComponents(slug)} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-8 sm:py-12 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-lg sm:text-xl font-bold mb-2">Ready to try server-side analytics?</h2>
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
