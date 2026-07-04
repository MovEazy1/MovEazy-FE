import { test, expect } from "@playwright/test";

/**
 * Payment + checkout smoke against a deployed origin.
 * Run: PLAYWRIGHT_BASE_URL=https://moveasy-30eed.web.app/ npm run e2e -- e2e/smoke.production.spec.js
 * (Trailing slash on baseURL matches vite base: "/".)
 */

async function expectRazorpayHostedLinks(page) {
  const hosted = page.locator('a[href*="rzp.io"], a[href*="razorpay.com"]');
  await expect(hosted.first()).toBeVisible();
  const count = await hosted.count();
  for (let i = 0; i < count; i++) {
    const href = await hosted.nth(i).getAttribute("href");
    expect(href, `link ${i} should point at Razorpay hosted`).toMatch(/rzp\.io|razorpay\.com/i);
  }
}

/** Order summary / pay hero line — avoids navbar “Flat ₹1,499 · Saver ₹1,999” duplicate matches. */
function mainHeroAmount(page) {
  return page.getByRole("main").locator(".font-extrabold.text-2xl.tabular-nums").first();
}

test.describe("MovEazy production — checkout & pay", () => {
  test("default /checkout shows Razorpay + WhatsApp (optional business UPI QR)", async ({ page }) => {
    await page.goto("./checkout");
    await expect(page.getByRole("heading", { name: /Checkout/i })).toBeVisible();
    await expectRazorpayHostedLinks(page);
    await expect(
      page.getByRole("img", { name: /UPI QR code/i }).or(page.getByText(/Business checkout/i)),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Share on WhatsApp/i })).toBeVisible();
    await expect(mainHeroAmount(page)).toContainText(/₹1,999/);
  });

  test("/checkout?sku=flat-search shows ₹1,499", async ({ page }) => {
    await page.goto("./checkout?sku=flat-search");
    await expect(page.getByText(/MovEazy Flat Search/i)).toBeVisible();
    await expect(mainHeroAmount(page)).toContainText(/₹1,499/);
    await expectRazorpayHostedLinks(page);
  });

  test("/checkout?sku=deposit-saver shows Guarantee ₹1,999", async ({ page }) => {
    await page.goto("./checkout?sku=deposit-saver");
    await expect(page.getByRole("main").getByText(/MovEazy Guarantee/i)).toBeVisible();
    await expect(mainHeroAmount(page)).toContainText(/₹1,999/);
    await expectRazorpayHostedLinks(page);
  });

  test("/pay?sku=flat-search — primary Razorpay CTA", async ({ page }) => {
    await page.goto("./pay?sku=flat-search");
    await expect(page.getByRole("heading", { name: /Pay securely/i })).toBeVisible();
    await expect(mainHeroAmount(page)).toContainText(/₹1,499/);
    const primary = page.getByRole("link", { name: /Pay on Razorpay/i });
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute("target", "_blank");
    await expect(primary).toHaveAttribute("href", /rzp\.io|razorpay\.com/i);
  });

  test("/pay?sku=deposit-saver — primary Razorpay CTA", async ({ page }) => {
    await page.goto("./pay?sku=deposit-saver");
    await expect(page.getByRole("main").getByText(/MovEazy Guarantee/i)).toBeVisible();
    await expect(mainHeroAmount(page)).toContainText(/₹1,999/);
    const primary = page.getByRole("link", { name: /Pay on Razorpay/i });
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute("href", /rzp\.io|razorpay\.com/i);
  });
});
