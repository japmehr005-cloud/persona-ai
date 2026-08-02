import { test, expect } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, login } from "./fixtures";

test.describe("Authentication", () => {
  test("rejects invalid credentials with an inline error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Password \+ OTP/i }).click();
    await page.getByLabel("Email").fill("demo@securebank.ai");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs the demo user in and lands on the dashboard", async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);

    await expect(page.getByRole("heading", { name: /Good day/ })).toBeVisible();
    await expect(page.getByText("Total balance")).toBeVisible();
  });

  test("redirects unauthenticated visitors away from protected pages", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
