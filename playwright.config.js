import { defineConfig, devices } from "@playwright/test";

/** Production smoke: PLAYWRIGHT_BASE_URL=https://moveasy-30eed.web.app/ (Firebase) or GitHub Pages URL */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173/MOVEASY-WEBSITE/";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
        url: "http://127.0.0.1:5173/MOVEASY-WEBSITE/",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
