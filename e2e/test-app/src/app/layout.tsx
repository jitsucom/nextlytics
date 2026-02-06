import type { ReactNode } from "react";
import { NextlyticsServer } from "@nextlytics/core/server";

export const metadata = {
  title: "E2E Test App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextlyticsServer>{children}</NextlyticsServer>
      </body>
    </html>
  );
}
