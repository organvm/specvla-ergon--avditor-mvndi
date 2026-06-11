import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage loads with form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Digital Alignment/i })).toBeVisible();

    await page.getByRole("button", { name: /Initiate Alignment/i }).click();
    await expect(page.locator("#link")).toBeVisible();
    await expect(page.locator("#business")).toBeVisible();
    await expect(page.locator("#goals")).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate Strategic Audit/i })).toBeVisible();
  });

  test("nav links work", async ({ page }) => {
    await page.goto("/");

    await page.click('a[href="/about"]');
    await expect(page.getByRole("heading", { name: /The Cosmic Pillars/i })).toBeVisible();

    await page.click('a[href="/examples"]');
    await expect(page.getByRole("heading", { name: "Cosmic Growth in Action" })).toBeVisible();

    await page.click('a[href="/settings"]');
    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.locator("#apikey")).toBeVisible();
  });

  test("about page has all four pillars", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "Mercury" })).toBeVisible();
    await expect(page.getByText("Communication")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Venus" })).toBeVisible();
    await expect(page.getByText("Aesthetic")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mars" })).toBeVisible();
    await expect(page.getByText("Drive")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saturn" })).toBeVisible();
    await expect(page.getByText("Structure")).toBeVisible();
  });

  test("examples page shows case studies", async ({ page }) => {
    await page.goto("/examples");
    await expect(page.getByText("Acme Corp SaaS")).toBeVisible();
    await expect(page.getByText("Zenith Creatives")).toBeVisible();
  });
});
