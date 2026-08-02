import { OTP } from "otplib";
import { test, expect } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, login } from "./fixtures";

const totp = new OTP({ strategy: "totp" });

test.describe("Real TOTP two-factor authentication", () => {
  test("enrolls, requires a second step at login, and can be disabled again", async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);

    await page.goto("/settings");
    await page.getByRole("tab", { name: "Security" }).click();
    await expect(page.getByText("Two-factor authentication")).toBeVisible();

    // --- Enroll ---
    await page.getByRole("button", { name: "Set up" }).click();
    const setupDialog = page.getByRole("dialog", { name: "Set up two-factor authentication" });
    const secret = (await setupDialog.locator("p.font-mono").textContent())?.trim().replace(/\s+/g, "");
    expect(secret).toMatch(/^[A-Z2-7]+$/);

    const setupCode = await totp.generate({ secret: secret! });
    await setupDialog.getByRole("textbox", { name: "6-digit setup code" }).pressSequentially(setupCode);
    await setupDialog.getByRole("button", { name: "Confirm and enable" }).click();
    await expect(page.getByText("Two-factor authentication enabled.")).toBeVisible();
    await expect(page.getByText("Two-factor authentication is enabled.")).toBeVisible();

    // --- Log out, then log back in: password alone must hand off to step 2 ---
    await page.goto("/dashboard");
    await page.locator('[data-slot="dropdown-menu-trigger"]').click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL("**/login");
    await page.getByRole("button", { name: /Authenticator app/i }).click();
    await page.getByLabel("Email").fill(DEMO_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.waitForURL("**/login/verify-2fa**");
    await expect(page.getByText("Two-factor verification")).toBeVisible();

    const loginCode = await totp.generate({ secret: secret! });
    await page.getByRole("textbox", { name: "6-digit authenticator code" }).pressSequentially(loginCode);
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await page.waitForURL("**/dashboard");

    // --- Disable again, restoring single-step login for other demo-account tests ---
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Security" }).click();
    await page.getByRole("button", { name: "Disable" }).click();
    const disableDialog = page.getByRole("dialog", { name: "Disable two-factor authentication" });
    const disableCode = await totp.generate({ secret: secret! });
    await disableDialog.getByRole("textbox", { name: "6-digit disable code" }).pressSequentially(disableCode);
    await disableDialog.getByRole("button", { name: "Disable two-factor authentication" }).click();
    await expect(page.getByText("Two-factor authentication disabled.")).toBeVisible();
    await expect(page.getByText("Not yet enabled.")).toBeVisible();
  });
});
