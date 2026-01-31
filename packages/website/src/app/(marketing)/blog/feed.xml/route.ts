import { Feed } from "feed";
import { articles } from "@/copy/blog";

const SITE_URL = "https://nextlytics.dev";

export async function GET() {
  const feed = new Feed({
    title: "Nextlytics Blog",
    description: "Articles about web analytics, privacy, performance, and server-side tracking.",
    id: `${SITE_URL}/blog`,
    link: `${SITE_URL}/blog`,
    language: "en",
    feedLinks: {
      rss2: `${SITE_URL}/blog/feed.xml`,
    },
    copyright: `${new Date().getFullYear()} Nextlytics`,
  });

  for (const article of articles) {
    feed.addItem({
      title: article.title,
      id: `${SITE_URL}/blog/${article.slug}`,
      link: `${SITE_URL}/blog/${article.slug}`,
      description: article.description,
      date: new Date(article.publishedAt),
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
