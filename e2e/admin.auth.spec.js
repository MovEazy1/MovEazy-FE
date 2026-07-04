import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.MOVEASY_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.MOVEASY_ADMIN_PASSWORD || "";

test.describe("Admin authenticated flow", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Admin credentials not provided");

  test("admin can sign in and access dashboard controls", async ({ page }) => {
    await page.goto("./login");

    await page.getByRole("button", { name: /Admin.*Manage all listings and assignments/i }).click();
    await page.getByPlaceholder("you@gmail.com").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Enter password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /Sign In as Admin/i }).click();

    await expect(page).toHaveURL(/admin/);
    await expect(page.getByText(/Admin Dashboard/i)).toBeVisible();
    await expect(page.getByText(/User Management/i)).toBeVisible();
    await expect(page.getByText(/^Create listing$/i).first()).toBeVisible();
    await expect(page.getByText(/Broker Bulk Import/i)).toBeVisible();

    await page.getByRole("button", { name: /^Map$/i }).click();
    await expect(page).toHaveURL(/map/);
    await expect(page.getByText(/Map Listings/i)).toBeVisible();

    await page.goto("./admin");
    await page.getByRole("button", { name: /^Home$/i }).click();
    await expect(page.getByRole("heading", { name: /Find Verified Properties/i })).toBeVisible();
  });
});
