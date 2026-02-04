"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/integrations", label: "Integrations" },
  { href: "/blog", label: "Blog" },
];

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <div className="w-5 h-4 flex flex-col justify-between">
      <span
        className={`block h-0.5 w-full bg-current transform transition-all duration-300 origin-center
                    ${open ? "rotate-45 translate-y-[7px]" : ""}`}
      />
      <span
        className={`block h-0.5 w-full bg-current transition-all duration-300
                    ${open ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"}`}
      />
      <span
        className={`block h-0.5 w-full bg-current transform transition-all duration-300 origin-center
                    ${open ? "-rotate-45 -translate-y-[7px]" : ""}`}
      />
    </div>
  );
}

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close menu on route change or escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <nav className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left side: Logo + Nav links */}
        <div className="flex items-center gap-8">
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <Logo />
          </Link>

          {/* Desktop navigation links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2
                  after:absolute after:left-3 after:right-3 after:bottom-1 after:h-px after:bg-violet-500
                  after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right side: CTA + Demo + GitHub */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            asChild
            size="sm"
            className="duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(124,58,237,0.3)]"
          >
            <Link href="#how-it-works">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/demo">Demo</Link>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" aria-label="GitHub">
            <Link
              href="https://github.com/jitsucom/nextlytics"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="size-5" />
            </Link>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          <BurgerIcon open={mobileMenuOpen} />
        </button>
      </nav>

      {/* Mobile navigation overlay */}
      <div
        className={`md:hidden fixed inset-0 top-16 bg-black/20 backdrop-blur-sm transition-opacity duration-300
                    ${mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile navigation panel */}
      <div
        className={`md:hidden absolute top-16 left-0 right-0 bg-background border-b border-border shadow-lg
                    transform transition-all duration-300 ease-out origin-top
                    ${mobileMenuOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-95 pointer-events-none"}`}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-1">
          {navLinks.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-base text-muted-foreground hover:text-foreground hover:bg-muted
                                transition-all duration-200 py-3 px-3 -mx-3 rounded-lg
                                ${mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
              style={{ transitionDelay: mobileMenuOpen ? `${i * 50}ms` : "0ms" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div
            className={`flex flex-col gap-3 pt-3 mt-2 border-t border-border
                            transition-all duration-200
                            ${mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
            style={{ transitionDelay: mobileMenuOpen ? `${navLinks.length * 50}ms` : "0ms" }}
          >
            <Button asChild size="sm" className="w-full">
              <Link href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
                Get Started
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="/demo" onClick={() => setMobileMenuOpen(false)}>
                  Demo
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon-sm" aria-label="GitHub">
                <Link
                  href="https://github.com/jitsucom/nextlytics"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
