import Image from "next/image";
import { Server, Monitor, RefreshCw } from "lucide-react";
import type { IntegrationMeta, IntegrationTag } from "@/copy/integrations";
import { GradientCard } from "@/components/ui/gradient-card";

const typeColors = {
  backend: "bg-blue-100 text-blue-700",
  plugin: "bg-purple-100 text-purple-700",
} as const;

const tagConfig: Record<
  IntegrationTag,
  { label: string; color: string; dot?: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  stable: { label: "Stable", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  beta: { label: "Beta", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  "coming-soon": { label: "Coming Soon", color: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-400" },
  "client-side": { label: "Client-side", color: "bg-sky-100 text-sky-700", icon: Monitor },
  "server-side": { label: "Server-side", color: "bg-indigo-100 text-indigo-700", icon: Server },
  hybrid: { label: "Hybrid", color: "bg-violet-100 text-violet-700", icon: RefreshCw },
} as const;

function CardContent({ integration }: { integration: IntegrationMeta }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        <Image
          src={integration.logo}
          alt={integration.logoAlt || integration.name}
          width={32}
          height={32}
          className="object-contain"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-foreground group-hover:text-violet-600 transition-colors">
            {integration.name}
          </h3>
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${typeColors[integration.type]}`}
          >
            {integration.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-3">
          {integration.tags.map((tag) => {
            const config = tagConfig[tag];
            const Icon = config.icon;
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}
              >
                {config.dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
                {Icon && <Icon className="w-3 h-3" />}
                {config.label}
              </span>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{integration.description}</p>
      </div>
    </div>
  );
}

export function IntegrationCard({ integration }: { integration: IntegrationMeta }) {
  const isComingSoon = integration.tags.includes("coming-soon");

  return (
    <GradientCard href={`/integrations/${integration.slug}`} disabled={isComingSoon}>
      <CardContent integration={integration} />
    </GradientCard>
  );
}
