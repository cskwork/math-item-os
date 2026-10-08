import { defineConfig } from "vitest/config";
import path from "node:path";

// Offline verification only; deliberately does not run database globalSetup.
export default defineConfig({
  cacheDir: path.resolve(__dirname, ".cache/datasource-security-vitest"),
  test: { environment: "node", include: ["src/test-database-guard.test.ts"] },
});
