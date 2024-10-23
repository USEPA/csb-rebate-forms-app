import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000");

    const heading = page.getByRole("heading", { name: "Your Rebate Forms" });
    await expect(heading).toBeVisible();
  });

  test("View 2022 Rebate Form Submissions", async ({ page }) => {
    await page.getByLabel("Rebate Year:").selectOption("2022");

    const table = page.getByLabel("Your 2022 Rebate Forms");
    await expect(table).toBeVisible();
  });

  test("View 2023 Rebate Form Submissions", async ({ page }) => {
    await page.getByLabel("Rebate Year:").selectOption("2023");

    const table = page.getByLabel("Your 2023 Rebate Forms");
    await expect(table).toBeVisible();
  });
});
