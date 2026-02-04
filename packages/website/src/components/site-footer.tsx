import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="py-8 border-t border-border">
      <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Built by{" "}
          <Link
            href="https://jitsu.com"
            className="text-foreground hover:underline transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jitsu
          </Link>
          . Open source under MIT.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/blog"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Blog
          </Link>
          <Link
            href="https://github.com/jitsucom/nextlytics"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
          <Link
            href="https://github.com/jitsucom/nextlytics/blob/main/LICENSE"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            License
          </Link>
        </div>
      </div>
    </footer>
  );
}
