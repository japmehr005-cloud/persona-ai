import { test, expect } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, closeSimulateDialog, login, simulatePayment } from "./fixtures";

test.describe("Adaptive Risk Engine and CB-OTP", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
  });

  test("scores a small, known-merchant payment well under the step-up threshold", async ({ page }) => {
    await simulatePayment(page, { merchant: "Salary Credit - Infosys", amount: "250" });

    const dialog = page.getByRole("dialog", { name: "Risk assessment result" });
    await expect(dialog.getByText("High risk")).toHaveCount(0);
    await expect(dialog.getByText("Step-up verification required")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "View transaction" })).toBeVisible();
  });

  test("flags a large payment to an unfamiliar merchant, requires OTP, and approves on correct code", async ({
    page,
  }) => {
    // Build up transaction velocity in the last hour so the Adaptive Risk
    // Engine's velocity factor contributes, then inject simulated call/SMS
    // signals from the Context Signal Simulator so this scenario reliably
    // crosses the step-up authentication threshold.
    for (let i = 0; i < 3; i += 1) {
      await simulatePayment(page, { merchant: `Warm-up Merchant ${i}`, amount: "150" });
      await closeSimulateDialog(page);
    }

    await page.goto("/dev/context-simulator");
    await page.getByRole("button", { name: "Trigger" }).nth(0).click();
    await expect(page.getByText("Signal injected")).toBeVisible();
    await page.getByRole("button", { name: "Trigger" }).nth(1).click();
    await expect(page.getByRole("button", { name: "Clear all" })).toBeVisible();

    await page.goto("/dashboard");
    const merchant = `Unfamiliar Wire Desk ${Date.now()}`;
    await simulatePayment(page, { merchant, amount: "500000" });

    const dialog = page.getByRole("dialog", { name: "Risk assessment result" });
    await expect(dialog.getByText("High risk")).toBeVisible();
    await expect(dialog.getByText("Step-up verification required")).toBeVisible();
    await expect(dialog.getByText(/verification code is shown here/)).toBeVisible();

    // The demo delivery channel surfaces the OTP directly in this dialog
    // (no real email/SMS provider configured), so capture it before
    // navigating to the verification page, which doesn't repeat it.
    const demoCode = (await dialog.locator("span.font-mono.font-semibold.tabular-nums").textContent())?.trim();
    expect(demoCode).toMatch(/^\d{6}$/);

    await dialog.getByRole("button", { name: "Verify now" }).click();
    await page.waitForURL("**/verify/otp**");

    await page.getByRole("textbox", { name: "6-digit verification code" }).pressSequentially(demoCode!);
    await page.getByRole("button", { name: "Verify and approve" }).click();

    await expect(page.getByText("Transaction approved")).toBeVisible();
  });
});
