import { test, expect } from "@playwright/test";
// ---
import { url, frf2024MongoId } from "./config";

test.describe("Dashboard", () => {
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

test.describe("Helpdesk", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url);

    const heading = page.getByRole("heading", { name: "Your Rebate Forms" });
    await expect(heading).toBeVisible();
  });

  test("Submission Results", async ({ page }) => {
    const root = page.locator("#root");

    await root.getByRole("link", { name: "Helpdesk" }).click();
    await root.getByLabel("Search submissions by ID").fill(frf2024MongoId);
    await root.getByRole("button", { name: "Search" }).click();

    const table = root.getByLabel("Submission Search Results");
    await expect(table).toBeVisible();
  });
});
