import { test, expect } from "@playwright/test";

test.describe("Documentation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/docs");
  });

  test("should display documentation home page", async ({ page }) => {
    // Check main heading
    await expect(page.getByRole("heading", { name: /Welcome to AsyncAnticheat/i })).toBeVisible();

    // Check for key sections
    await expect(page.getByText(/What Is AsyncAnticheat\?/i)).toBeVisible();
    await expect(page.getByText(/How Does It Work\?/i)).toBeVisible();
    await expect(page.getByText(/Quick Start/i)).toBeVisible();
  });

  test("should have working sidebar navigation", async ({ page }) => {
    // Check sidebar is visible (on desktop)
    const introLink = page.getByRole("link", { name: "Introduction" });
    await expect(introLink).toBeVisible();

    // Navigate to Installation
    await page.getByRole("link", { name: "Plugin Installation" }).click();
    await expect(page).toHaveURL(/\/docs\/installation/);
  });

  test("should have search functionality", async ({ page }) => {
    // Check search input exists
    const searchInput = page.getByPlaceholder(/Search documentation/i);
    await expect(searchInput).toBeVisible();
  });

  test("should display footer with dashboard link", async ({ page }) => {
    // Scroll to bottom to see footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check for dashboard link in footer
    await expect(page.getByRole("link", { name: /Go to Dashboard/i })).toBeVisible();
  });
});

test.describe("Documentation - Mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("should have hamburger menu for navigation on mobile", async ({ page }) => {
    await page.goto("/docs");

    // Check for menu button (Nextra uses Menu button on mobile)
    const menuButton = page.getByRole("button", { name: /Menu/i });
    await expect(menuButton).toBeVisible();
  });

  test("should be able to navigate documentation on mobile", async ({ page }) => {
    await page.goto("/docs");

    // Content should still be readable
    await expect(page.getByRole("heading", { name: /Welcome to AsyncAnticheat/i })).toBeVisible();

    // Next page link should work
    const nextLink = page.getByRole("link", { name: /Plugin Installation/i });
    await nextLink.click();
    await expect(page).toHaveURL(/\/docs\/installation/);
  });
});
