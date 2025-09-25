import { test, expect } from "@playwright/test";
// ---
import { url, frf2024MongoId } from "./config";

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
