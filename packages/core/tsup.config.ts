import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts", "src/**/*.tsx", "!src/**/*.test.ts", "!src/**/*.d.ts"],
  // CJS only - Next.js 15 has issues with ESM imports (next/headers resolution),
  // and Next.js 16+ can consume CJS without problems
  format: ["cjs"],
  dts: true,
  bundle: false,
  external: ["react", "next", "posthog-js", "@neondatabase/serverless"],
});
