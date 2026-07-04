import { test, expect } from "@playwright/test";

test.describe("Moveazy core smoke", () => {
  test("home page renders primary CTA", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { name: /Find Verified Properties/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Search$/i }).first()).toBeVisible();
  });

  test("map page loads with listings UI", async ({ page }) => {
    await page.goto("./map");
    await expect(page.getByText(/Map Listings/i)).toBeVisible();
    await expect(page.getByText(/properties/i).first()).toBeVisible();
  });

  test("map page mobile shows filter and properties controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./map");
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Properties|Hide/i })).toBeVisible();
  });

  test("admin route is protected for signed-out users", async ({ page }) => {
    await page.goto("./admin");
    await expect(page).toHaveURL(/login/);
    await expect(page.getByRole("heading", { name: /Moveazy/i })).toBeVisible();
  });
});
