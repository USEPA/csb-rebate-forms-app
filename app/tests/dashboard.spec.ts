import { test, expect } from "@playwright/test";
// ---
import { url } from "./config";

test.describe("Rebate Year Selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url);

    const heading = page.getByRole("heading", { name: "Your Rebate Forms" });
    await expect(heading).toBeVisible();
  });

  test("2022 Submissions", async ({ page }) => {
    await page.getByLabel("Rebate Year:").selectOption("2022");

    const table = page.getByLabel("Your 2022 Rebate Forms");
    await expect(table).toBeVisible();
  });

  test("2023 Submissions", async ({ page }) => {
    await page.getByLabel("Rebate Year:").selectOption("2023");

    const table = page.getByLabel("Your 2023 Rebate Forms");
    await expect(table).toBeVisible();
  });

  test("2024 Submissions", async ({ page }) => {
    await page.getByLabel("Rebate Year:").selectOption("2024");

    const table = page.getByLabel("Your 2024 Rebate Forms");
    await expect(table).toBeVisible();
  });
});

test.describe("Submission Enrollment Period", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("*/**/api/config", async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      json["submissionPeriodOpen"]["2024"]["frf"] = false;

      await route.fulfill({ response, json });
    });

    await page.goto(url);

    const heading = page.getByRole("heading", { name: "Your Rebate Forms" });
    await expect(heading).toBeVisible();
  });

  test("Enrollment Period Closed", async ({ page }) => {
    const select = page.getByLabel("Rebate Year:");

    await select.selectOption("2024");

    const table2024 = page.getByLabel("Your 2024 Rebate Forms");
    const button = page.getByRole("button", { name: "New Application" });

    await expect(table2024).toBeVisible();
    await expect(button).toBeDisabled();

    await select.selectOption("2023");

    const table2023 = page.getByLabel("Your 2023 Rebate Forms");
    const link = page.getByRole("link", { name: "New Application" });

    await expect(table2023).toBeVisible();
    await expect(link).toBeEnabled();
  });
});
