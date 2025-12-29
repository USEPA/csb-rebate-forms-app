import path from "node:path";
import { test, expect } from "@playwright/test";
// ---
import { url, username, password } from "./config";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

test("log in", async ({ page }) => {
  await page.goto(`${url}/welcome`);

  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();

  await page.waitForURL(url);

  const heading = page.getByRole("heading", {
    name: "Clean School Bus Rebate Forms",
  });
  await expect(heading).toBeVisible();

  await page.context().storageState({ path: authFile });
});
