import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the hero section with correct title", async ({ page }) => {
    // Check for the AsyncAnticheat branding
    await expect(page.getByRole("link", { name: /AsyncAnticheat/i })).toBeVisible();

    // Check for main CTA buttons
    await expect(page.getByRole("link", { name: "Open Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: /View on GitHub/i })).toBeVisible();
  });

  test("should display feature cards", async ({ page }) => {
    // Check for feature section
    await expect(page.getByText("Why choose AsyncAnticheat?")).toBeVisible();

    // Check for feature cards
    await expect(page.getByText("Async by Design")).toBeVisible();
    await expect(page.getByText("Modular Architecture")).toBeVisible();
    await expect(page.getByText("Open Source")).toBeVisible();
  });

  test("should display FAQ section with expandable items", async ({ page }) => {
    // Check FAQ heading
    await expect(page.getByText("Frequently Asked Questions")).toBeVisible();

    // Click on a FAQ item to expand it
    const faqButton = page.getByRole("button", { name: "What is AsyncAnticheat?" });
    await expect(faqButton).toBeVisible();
    await faqButton.click();

    // Check that the answer is now visible
    await expect(page.getByText(/next-generation anticheat system/i)).toBeVisible();
  });

  test("should navigate to docs when clicking View Docs", async ({ page }) => {
    await page.getByRole("link", { name: "View Docs" }).first().click();
    await expect(page).toHaveURL(/\/docs/);
  });

  test("should navigate to dashboard when clicking Open Dashboard", async ({ page }) => {
    await page.getByRole("link", { name: "Open Dashboard" }).click();
    // Should redirect to login since not authenticated
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });
});

test.describe("Landing Page - Mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("should show hamburger menu on mobile", async ({ page }) => {
    await page.goto("/");

    // Check hamburger menu button is visible
    const menuButton = page.getByRole("button", { name: /menu/i });
    await expect(menuButton).toBeVisible();

    // Desktop nav should be hidden
    const desktopNav = page.locator("nav.hidden.md\\:flex");
    await expect(desktopNav).toBeHidden();
  });

  test("should open mobile menu when clicking hamburger", async ({ page }) => {
    await page.goto("/");

    // Click hamburger menu
    await page.getByRole("button", { name: /menu/i }).click();

    // Check mobile menu items are visible
    await expect(page.getByRole("link", { name: "GitHub" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documentation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("should close mobile menu when clicking a link", async ({ page }) => {
    await page.goto("/");

    // Open menu
    await page.getByRole("button", { name: /menu/i }).click();

    // Click Documentation link in mobile menu
    await page.getByRole("link", { name: "Documentation" }).click();

    // Should navigate to docs
    await expect(page).toHaveURL(/\/docs/);
  });
});
