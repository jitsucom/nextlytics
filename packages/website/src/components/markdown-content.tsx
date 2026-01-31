import { MDXRemote, MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
  components?: MDXRemoteProps["components"];
};

const rehypePrettyCodeOptions = {
  theme: "github-light",
  keepBackground: false,
};

export function MarkdownContent({ content, components }: Props) {
  return (
    <div className="prose prose-zinc max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg">
      <MDXRemote
        source={content}
        components={components}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [[rehypePrettyCode, rehypePrettyCodeOptions]],
          },
        }}
      />
    </div>
  );
}
