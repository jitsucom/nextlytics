export type ArticleMeta = {
  title: string;
  slug: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  /** Reading time in minutes */
  readTime: number;
};
