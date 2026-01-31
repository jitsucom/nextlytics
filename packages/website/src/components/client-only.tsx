"use client";

import { useState, useLayoutEffect, type ReactNode } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    setReady(true);
  }, []);

  return ready ? children : fallback;
}
