import { Calendar, Clock } from "lucide-react";
import type { ArticleMeta } from "@/copy/blog";
import { GradientCard } from "@/components/ui/gradient-card";

export function ArticleCard({ article }: { article: ArticleMeta }) {
  const date = new Date(article.publishedAt);
  const formattedDate = date
    .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    .replace(/ /g, "\u00A0"); // non-breaking spaces

  return (
    <GradientCard href={`/blog/${article.slug}`}>
      <div className="flex flex-col gap-3 h-full">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-violet-600 transition-colors">
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{article.description}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto">
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
    </GradientCard>
  );
}
