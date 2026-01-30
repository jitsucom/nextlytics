import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts", "src/**/*.tsx", "!src/**/*.test.ts", "!src/**/*.d.ts"],
  format: ["esm", "cjs"],
  dts: true,
  bundle: false,
  external: ["react", "next", "posthog-js", "@neondatabase/serverless"],
});
