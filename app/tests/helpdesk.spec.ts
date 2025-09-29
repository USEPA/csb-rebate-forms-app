import { test, expect } from "@playwright/test";
// ---
import { url, frf2024MongoId } from "./config";

test.describe("Submission Results Found", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url);
    await page.locator("#root").getByRole("link", { name: "Helpdesk" }).click();
  });

  test("Searched form submission is found", async ({ page }) => {
    await page.getByLabel("Search submissions by ID").fill(frf2024MongoId);
    await page.locator("#root").getByRole("button", { name: "Search" }).click();

    const table = page.getByLabel("Submission Search Results");
    await expect(table).toBeVisible();
  });
});

test.describe("No Submission Found", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url);
    await page.locator("#root").getByRole("link", { name: "Helpdesk" }).click();
  });

  test("Error message is displayed for a form submission that doesn't exist", async ({
    page,
  }) => {
    await page.getByLabel("Search submissions by ID").fill("000000");
    await page.locator("#root").getByRole("button", { name: "Search" }).click();

    const message = page.getByText("Error loading form submission. Please confirm the form type and ID is correct and search again."); // prettier-ignore
    await expect(message).toBeVisible();
  });
});
