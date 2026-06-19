import { test, expect } from "@playwright/test";

test.describe("Audit Flow", () => {
  test("shows error when API key is missing", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Initiate Alignment/i }).click();
    await page.locator("#link").fill("https://example.com");
    await page.locator("#business").fill("Technology");
    await page.locator("#goals").fill("Increase conversions");

    await page.getByRole("button", { name: /Generate Strategic Audit/i }).click();

    await expect(
      page.getByText("Please configure your AI key in Settings.")
    ).toBeVisible();
  });

  test("redirects to results when API key is set", async ({ page }) => {
    // Set API key via localStorage
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("gemini_api_key", "test-key-123");
    });
    await page.reload();

    await page.getByRole("button", { name: /Initiate Alignment/i }).click();
    await page.locator("#link").fill("https://example.com");
    await page.locator("#business").fill("Technology");
    await page.locator("#goals").fill("Increase conversions");

    await page.getByRole("button", { name: /Generate Strategic Audit/i }).click();

    // Should navigate to /results
    await expect(page).toHaveURL(/\/results/);
  });

  test("results page shows error when accessed directly", async ({ page }) => {
    await page.goto("/results");

    await expect(
      page.getByText("No audit data found. Please start from the home page.")
    ).toBeVisible();
  });

  test("history page shows empty state for unauthenticated user", async ({ page }) => {
    await page.goto("/history");

    await expect(
      page.getByText("Your archive is empty")
    ).toBeVisible();
  });
});
