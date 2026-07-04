import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.MOVEASY_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.MOVEASY_ADMIN_PASSWORD || "";

test.describe("Admin write safety cycle", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Admin credentials not provided");

  test("create and delete a temporary listing in production", async ({ page }) => {
    const stamp = Date.now();
    const title = `E2E TEMP LISTING ${stamp}`;

    await page.goto("./login");
    await page.getByRole("button", { name: /Admin.*Manage all listings and assignments/i }).click();
    await page.getByPlaceholder("you@gmail.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Enter password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /Sign In as Admin/i }).click();
    await expect(page).toHaveURL(/#\/admin/);

    await page.locator('input[placeholder="Title"]').fill(title);
    await page.locator('input[placeholder="Price label"]').fill("₹ 12,345");
    await page.locator('input[placeholder="Monthly rent"]').fill("12345");
    await page.locator('input[placeholder="Address"]').fill("E2E Test Address, Bengaluru");
    await page.locator('input[placeholder="Seller name"]').fill("E2E Seller");
    await page.locator('input[placeholder="Seller email"]').fill(`e2e+${stamp}@gmail.com`);
    await page.locator('input[placeholder="Contact phone"]').fill("9876543210");
    await page.getByRole("button", { name: /^Create listing$/i }).click();

    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });

    const deleted = await page.evaluate((targetTitle) => {
      const rows = Array.from(document.querySelectorAll("div"));
      const row = rows.find((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        return text.includes(targetTitle) && text.includes("Delete");
      });
      if (!row) return false;
      const btn = Array.from(row.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Delete");
      if (!btn) return false;
      btn.click();
      return true;
    }, title);
    expect(deleted).toBeTruthy();
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 15000 });
  });
});
