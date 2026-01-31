import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getIntegration, integrations } from "@/copy/integrations";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return integrations.map((i) => ({ slug: i.slug }));
}

function getStatusFromTags(tags: string[]): string {
  if (tags.includes("stable")) return "Stable";
  if (tags.includes("beta")) return "Beta";
  if (tags.includes("coming-soon")) return "Coming Soon";
  return "Unknown";
}

function getModeFromTags(tags: string[]): string {
  if (tags.includes("hybrid")) return "Hybrid (client + server)";
  if (tags.includes("server-side")) return "Server-side";
  if (tags.includes("client-side")) return "Client-side";
  return "Unknown";
}

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const integration = getIntegration(slug);

  if (!integration) {
    return new NextResponse("Not found", { status: 404 });
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
  const status = getStatusFromTags(integration.tags);
  const mode = getModeFromTags(integration.tags);

  const markdown = `# ${integration.name} ${typeLabel} for Nextlytics

${integration.description}

- Type: ${typeLabel}
- Status: ${status}
- Mode: ${mode}

${documentation}`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
