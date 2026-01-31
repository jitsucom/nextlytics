import type { Metadata } from "next";
import Link from "next/link";
import { Rss } from "lucide-react";
import { articles } from "@/copy/blog";
import { ArticleCard } from "@/components/article-card";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Blog - Nextlytics",
  description:
    "Learn about server-side analytics, GDPR compliance, and modern web tracking with Nextlytics.",
};

export default function BlogPage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Nextlytics", href: "/" }]}
        title="Blog"
        extras={
          <Link
            href="/blog/feed.xml"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="RSS Feed"
          >
            <Rss className="w-5 h-5" />
          </Link>
        }
        description={
          <p>
            Articles about web analytics, privacy, performance, and why server-side tracking
            matters. Learn the ideas behind Nextlytics.
          </p>
        }
      />

      <div className="max-w-5xl mx-auto px-6 pb-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>

        {articles.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No articles yet.</p>
        )}
      </div>
    </section>
  );
}
