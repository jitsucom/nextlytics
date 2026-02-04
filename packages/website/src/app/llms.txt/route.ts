import {
  tagline,
  description,
  packageManagers,
  backendConfigs,
  integrationFiles,
  benefits,
  features,
} from "@/copy";
import { integrations } from "@/copy/integrations";

function generateLlmsTxt(): string {
  const lines: string[] = [];

  // Title and description
  lines.push(`# Nextlytics - ${tagline}`);
  lines.push("");
  lines.push(description);
  lines.push("");

  // Benefits
  lines.push("## Why Nextlytics?");
  lines.push("");
  lines.push("Traditional analytics compromise privacy, slow down your site, and miss data");
  lines.push("due to ad blockers. Nextlytics fixes all of that.");
  lines.push("");
  for (const benefit of benefits) {
    lines.push(`### ${benefit.title}`);
    lines.push(benefit.description);
    lines.push("");
  }

  // How it works
  lines.push("## Add Analytics in 3 Steps");
  lines.push("");
  lines.push("No complex setup. No dashboard configuration. Just a few lines of code.");
  lines.push("");

  // Step 1: Install
  lines.push("### Step 1: Install the package");
  lines.push("");
  lines.push("```bash");
  lines.push(packageManagers.npm);
  lines.push("# or");
  lines.push(packageManagers.bun);
  lines.push("# or");
  lines.push(packageManagers.pnpm);
  lines.push("# or");
  lines.push(packageManagers.yarn);
  lines.push("```");
  lines.push("");

  // Step 2: Configure backend
  lines.push("### Step 2: Configure your backend");
  lines.push("");
  for (const [_key, config] of Object.entries(backendConfigs)) {
    lines.push(`#### ${config.label}`);
    lines.push("");
    lines.push("```typescript");
    lines.push(config.code);
    lines.push("```");
    lines.push("");
  }

  // Step 3: Integrate
  lines.push("### Step 3: Integrate with your app");
  lines.push("");
  for (const file of Object.values(integrationFiles)) {
    lines.push(`#### ${file.filename}`);
    lines.push("");
    lines.push("```typescript");
    lines.push(file.code);
    lines.push("```");
    lines.push("");
  }
  lines.push("That's it. Every page view is now tracked server-side.");
  lines.push("");

  // Features
  lines.push("## Features");
  lines.push("");
  for (const feature of features) {
    lines.push(`### ${feature.title}`);
    lines.push(feature.description);
    lines.push("");
  }

  // Integrations
  lines.push("## Integrations");
  lines.push("");
  lines.push(
    "Nextlytics is a stateless analytics layer. It collects and transforms data but doesn't"
  );
  lines.push(
    "store it. You need a backend to send your analytics to. Plugins extend Nextlytics by"
  );
  lines.push("transforming or enriching data in flight.");
  lines.push("");
  for (const integration of integrations) {
    const typeLabel = integration.type === "backend" ? "Backend" : "Plugin";
    lines.push(
      `- [${integration.name} ${typeLabel}](/integrations/${integration.slug}.md): ${integration.description}`
    );
  }
  lines.push("");

  // Links
  lines.push("## Links");
  lines.push("");
  lines.push("- GitHub: https://github.com/jitsucom/nextlytics");
  lines.push("- License: MIT");
  lines.push("- Built by Jitsu: https://jitsu.com");

  return lines.join("\n");
}

export function GET() {
  const content = generateLlmsTxt();
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
