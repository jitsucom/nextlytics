import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Content to display on the right side of the title */
  extras?: React.ReactNode;
  /** Use hero style with gradient background (for detail pages) */
  variant?: "default" | "hero";
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  children,
  extras,
  variant = "default",
}: PageHeaderProps) {
  const parentItem = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;

  const content = (
    <>
      {/* Mobile: back link (only for detail pages with parent) */}
      {parentItem?.href && (
        <Link
          href={parentItem.href}
          className="sm:hidden inline-flex items-center gap-1 text-sm text-muted-foreground
                        hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {parentItem.label}
        </Link>
      )}

      {/* Desktop: breadcrumb (small font) */}
      {breadcrumbs.length > 0 && (
        <nav className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mb-4">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4" />}
              {item.href ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title (large font) + extras */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {extras}
      </div>

      {description && (
        <div className="mb-4 text-sm sm:text-base text-foreground/80">{description}</div>
      )}

      {children}
    </>
  );

  if (variant === "hero") {
    return (
      <section className="bg-gradient-to-b from-violet-50/50 to-background border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-8 sm:py-12">{content}</div>
      </section>
    );
  }

  return <div className="max-w-5xl mx-auto px-6 py-8 sm:py-12">{content}</div>;
}
