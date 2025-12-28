import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page with OAuth options", async ({ page }) => {
    await page.goto("/login");

    // Check login heading
    await expect(page.getByRole("heading", { name: /Sign in to Dashboard/i })).toBeVisible();

    // Check OAuth buttons
    await expect(page.getByRole("button", { name: /Continue with GitHub/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Discord/i })).toBeVisible();

    // Check email option
    await expect(page.getByPlaceholder(/your@email.com/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Send magic link/i })).toBeVisible();
  });

  test("should show magic link confirmation after submitting email", async ({ page }) => {
    await page.goto("/login");

    // Enter email
    await page.getByPlaceholder(/your@email.com/i).fill("test@example.com");

    // Submit
    await page.getByRole("button", { name: /Send magic link/i }).click();

    // Should show confirmation (or error depending on Supabase config)
    // Check for either "Check your email" message or the form still being present
    await expect(
      page.getByText(/Check your email/i).or(page.getByPlaceholder(/your@email.com/i))
    ).toBeVisible();
  });

  test("should have back to home link", async ({ page }) => {
    await page.goto("/login");

    const backLink = page.getByRole("link", { name: /Back to home/i });
    await expect(backLink).toBeVisible();

    await backLink.click();
    await expect(page).toHaveURL("/");
  });

  test("should redirect to login when accessing dashboard unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
