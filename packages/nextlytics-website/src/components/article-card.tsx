import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import type { ArticleMeta } from "@/copy/blog";

export function ArticleCard({ article }: { article: ArticleMeta }) {
  const date = new Date(article.publishedAt);
  const formattedDate = date
    .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    .replace(/ /g, "\u00A0"); // non-breaking spaces

  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block bg-background p-6 rounded-xl border border-border transition-all duration-300
                       hover:-translate-y-1 hover:border-violet-500 hover:shadow-[0_0_30px_rgba(124,58,237,0.15)]"
    >
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-violet-600 transition-colors">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{article.description}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formattedDate}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {article.readTime}&nbsp;min read
          </span>
        </div>
      </div>
    </Link>
  );
}
