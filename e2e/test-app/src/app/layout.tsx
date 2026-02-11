import type { ReactNode } from "react";
import { Server } from "@/nextlytics";

export const metadata = {
  title: "E2E Test App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Server>{children}</Server>
      </body>
    </html>
  );
}
