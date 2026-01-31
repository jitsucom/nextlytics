import type { Metadata } from "next";
import { integrations } from "@/copy/integrations";
import { IntegrationCard } from "@/components/integration-card";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Integrations - Nextlytics",
  description:
    "Connect Nextlytics to your analytics backend or extend it with plugins. " +
    "Google Analytics, Posthog, Vercel Geo, and more.",
};

export default function IntegrationsPage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Nextlytics", href: "/" }]}
        title="Integrations"
        description={
          <div className="space-y-3">
            <p>
              Nextlytics is a stateless analytics layer. It collects and transforms data but doesn't
              store it. You need a <strong className="text-foreground">backend</strong> to send your
              analytics to — Posthog, Google Analytics, your own database, or any other destination.
            </p>
            <p>
              <strong className="text-foreground">Plugins</strong> extend Nextlytics by transforming
              or enriching data in flight — adding geo data, filtering events, or modifying
              properties before they reach your backend.
            </p>
          </div>
        }
      />

      <div className="max-w-5xl mx-auto px-6 pb-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map((integration) => (
            <IntegrationCard key={integration.slug} integration={integration} />
          ))}
        </div>

        {integrations.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No integrations yet.</p>
        )}
      </div>
    </section>
  );
}
