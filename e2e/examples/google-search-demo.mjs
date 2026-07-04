/**
 * Standalone Playwright script (raw API, like anti-gravity style demos).
 * Run: node e2e/examples/google-search-demo.mjs
 *
 * Set HEADLESS=0 to watch the browser.
 */
import { chromium } from "playwright";

const headless = process.env.HEADLESS !== "0";

const browser = await chromium.launch({ headless });
const page = await browser.newPage();

await page.goto("https://www.google.com");
const q = page.locator('textarea[name="q"], input[name="q"]').first();
await q.fill("Playwright automation");
await q.press("Enter");
await page.waitForLoadState("domcontentloaded");

console.log("Title:", await page.title());
await browser.close();
