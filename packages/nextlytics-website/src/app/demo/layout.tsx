"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DemoFooter } from "@/components/demo-footer";
import { LoginModal } from "@/components/login-modal";
import { UserDropdown } from "@/components/user-dropdown";
import { ClientOnly } from "@/components/client-only";
import { Logo } from "@/components/logo";

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col bg-zinc-100 p-4 overflow-hidden">
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-xl border border-zinc-300 overflow-hidden">
        {/* Browser toolbar */}
        <div className="h-8 bg-zinc-200 border-b border-zinc-300 flex items-center px-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
        </div>
        {/* Browser content */}
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function DemoHeader() {
  const { data: session, status } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <header className="h-12 border-b border-zinc-200 bg-white px-4 flex items-center justify-between shrink-0">
      <Link href="/demo" className="flex items-center gap-2">
        <Logo size="sm" />
        <span className="text-muted-foreground font-normal">demo</span>
      </Link>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Back to main</Link>
        </Button>
        {status === "loading" ? (
          <Button size="sm" disabled>
            Loading...
          </Button>
        ) : session?.user?.email ? (
          <UserDropdown email={session.user.email} />
        ) : (
          <>
            <Button size="sm" onClick={() => setLoginOpen(true)}>
              Login
            </Button>
            <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
          </>
        )}
      </div>
    </header>
  );
}

const FOOTER_HEIGHT_KEY = "nextlytics-demo-footer-height";
const DEFAULT_FOOTER_HEIGHT = 250;

function DemoLayoutContent({ children }: { children: React.ReactNode }) {
  const [footerHeight, setFooterHeight] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_FOOTER_HEIGHT;
    const saved = localStorage.getItem(FOOTER_HEIGHT_KEY);
    return saved ? Number(saved) : DEFAULT_FOOTER_HEIGHT;
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY;
      const clamped = Math.max(100, Math.min(newHeight, window.innerHeight - 200));
      setFooterHeight(clamped);
      localStorage.setItem(FOOTER_HEIGHT_KEY, String(clamped));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="h-screen flex flex-col bg-zinc-100">
      <BrowserChrome>
        <DemoHeader />
        <main className="flex-1 overflow-auto bg-white">{children}</main>
      </BrowserChrome>
      <div
        className="h-1.5 bg-zinc-200 hover:bg-zinc-300 cursor-row-resize shrink-0 flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <div className="w-10 h-1 bg-zinc-400 rounded-full" />
      </div>
      <div style={{ height: footerHeight }} className="shrink-0">
        <DemoFooter />
      </div>
    </div>
  );
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientOnly>
      <SessionProvider>
        <DemoLayoutContent>{children}</DemoLayoutContent>
      </SessionProvider>
    </ClientOnly>
  );
}
