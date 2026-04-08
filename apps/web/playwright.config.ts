import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "./e2e/test-results",
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    locale: "ko-KR",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
