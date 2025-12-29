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

      json.submissionPeriodOpen["2024"].frf = false;

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
      const json = { results: false, entities: [] };

      await route.fulfill({ json });
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

test.describe("SAM.gov Debt Subject to Offset", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("*/**/api/bap/sam", async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      for (const entity of json.entities) {
        entity.DEBT_SUBJECT_TO_OFFSET_FLAG__c = "Y";
      }

      await route.fulfill({ response, json });
    });

    await page.goto(url);
  });

  test("When creating a new application, message is shown for any SAM.gov entities that have a debt subject to offset", async ({
    page,
  }) => {
    page.getByRole("link", { name: "New Application" }).click();

    const message = page.getByText("Ineligible SAM.gov Entities:");
    await expect(message).toBeVisible();
  });

  test("When viewing an existing application, error message is shown for a SAM.gov entity that has a debt subject to offset", async ({
    page,
  }) => {
    const table = page.getByLabel("Your 2024 Rebate Forms");
    table.getByRole("rowheader").first().getByRole("link").click();

    const message = page.getByText("Your SAM.gov account is either currently not active or ineligible due to an exclusion status or a debt subject to offset."); // prettier-ignore
    await expect(message).toBeVisible();
  });
});

test.describe("SAM.gov Exclusion Status", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("*/**/api/bap/sam", async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      for (const entity of json.entities) {
        entity.EXCLUSION_STATUS_FLAG__c = "D";
      }

      await route.fulfill({ response, json });
    });

    await page.goto(url);
  });

  test("When creating a new application, message is shown for any SAM.gov entities that have an exclusion status", async ({
    page,
  }) => {
    page.getByRole("link", { name: "New Application" }).click();

    const message = page.getByText("Ineligible SAM.gov Entities:");
    await expect(message).toBeVisible();
  });

  test("When viewing an existing application, error message is shown for a SAM.gov entity that has an exclusion status", async ({
    page,
  }) => {
    const table = page.getByLabel("Your 2024 Rebate Forms");
    table.getByRole("rowheader").first().getByRole("link").click();

    const message = page.getByText("Your SAM.gov account is either currently not active or ineligible due to an exclusion status or a debt subject to offset."); // prettier-ignore
    await expect(message).toBeVisible();
  });
});

test.describe("No Active SAM.gov Accounts", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("*/**/api/bap/sam", async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      for (const entity of json.entities) {
        entity.ENTITY_STATUS__c = ""; // NOTE: anything beyond "Active" is considered not active
      }

      await route.fulfill({ response, json });
    });

    await page.goto(url);
  });

  test("When creating a new application with no active SAM.gov accounts, messages are shown", async ({
    page,
  }) => {
    const warningMessage = page.getByText("At least one of your SAM.gov accounts is currently not active.") // prettier-ignore
    await expect(warningMessage).toBeVisible();

    page.getByRole("link", { name: "New Application" }).click();

    const infoMessage = page.getByText("There are no active SAM.gov accounts associated with your email."); // prettier-ignore
    await expect(infoMessage).toBeVisible();
  });
});

test.describe("No Form Submissions", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("*/**/api/formio/2024/frf-submissions", async (route) => {
      const json: never[] = [];

      await route.fulfill({ json });
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

test.describe("Form Submission Doesn't Exist", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${url}/frf/2024/000000000000000000000000`);
  });

  test("Error message is displayed for a form submission that doesn't exist", async ({
    page,
  }) => {
    const message = page.getByText("The requested submission does not exist, or you do not have access."); // prettier-ignore
    await expect(message).toBeVisible();
  });
});
