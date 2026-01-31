import {
  meta as goldenAgeOfLogFilesMeta,
  components as goldenAgeOfLogFilesComponents,
} from "./golden-age-of-log-files";
import { meta as gaMeasurementProtocolMeta } from "./google-analytics-measurement-protocol";
import type { ArticleMeta } from "./types";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

export type { ArticleMeta } from "./types";

type ArticleComponents = MDXRemoteProps["components"];

const articlesMap: Record<string, { meta: ArticleMeta; components?: ArticleComponents }> = {
  "golden-age-of-log-files": {
    meta: goldenAgeOfLogFilesMeta,
    components: goldenAgeOfLogFilesComponents,
  },
  "google-analytics-measurement-protocol": { meta: gaMeasurementProtocolMeta },
};

export const articles: ArticleMeta[] = Object.values(articlesMap).map((a) => a.meta);

export function getArticle(slug: string): ArticleMeta | undefined {
  return articlesMap[slug]?.meta;
}

export function getArticleComponents(slug: string): ArticleComponents | undefined {
  return articlesMap[slug]?.components;
}
