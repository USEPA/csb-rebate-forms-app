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
  });

  test("'New Application' button is disabled when enrollment period is closed", async ({
    page,
  }) => {
    const button = page.getByRole("button", { name: "New Application" });
    await expect(button).toBeDisabled();

    await page.getByLabel("Rebate Year:").selectOption("2023");

    const link = page.getByRole("link", { name: "New Application" });
    await expect(link).toBeEnabled();
  });
});

test.describe("No SAM.gov Data", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("*/**/api/bap/sam", async (route) => {
      const response = await route.fetch();
      const json = {
        results: false,
        entities: [],
      };

      await route.fulfill({ response, json });
    });

    await page.goto(url);
  });

  test("User is logged out and message is displayed when user has no SAM.gov data", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Sign in" });
    await expect(link).toBeVisible();

    const message = page.getByText("No SAM.gov accounts match your email.");
    await expect(message).toBeVisible();
  });
});

test.describe("No Form Submissions", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("*/**/api/formio/2024/frf-submissions", async (route) => {
      const response = await route.fetch();
      const json: never[] = [];

      await route.fulfill({ response, json });
    });

    await page.goto(url);
  });

  test("'New Application' message is displayed when user has no submissions", async ({
    page,
  }) => {
    const message = page.getByText("Please select the “New Application” button above"); // prettier-ignore
    await expect(message).toBeVisible();
  });
});
