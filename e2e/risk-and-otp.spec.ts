import { test, expect } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, closeSimulateDialog, login, simulatePayment } from "./fixtures";

test.describe("Adaptive Risk Engine and CB-OTP", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
  });

  test("scores a small, known-merchant payment well under the step-up threshold", async ({ page }) => {
    await simulatePayment(page, { merchant: "Salary Credit - Infosys", amount: "250" });

    const dialog = page.getByRole("dialog", { name: "Payment security decision" });
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
    // SMS + location feed the Risk Engine. Phone call feeds Social Engineering
    // Protection only (Continue Anyway is handled inside simulatePayment).
    await page.getByRole("button", { name: "Trigger" }).nth(1).click();
    await expect(page.getByText("Signal injected")).toBeVisible();
    await page.getByRole("button", { name: "Trigger" }).nth(2).click();
    await expect(page.getByRole("button", { name: "Clear all" })).toBeVisible();

    await page.goto("/dashboard");
    const merchant = `Unfamiliar Wire Desk ${Date.now()}`;
    await simulatePayment(page, { merchant, amount: "500000" });

    const dialog = page.getByRole("dialog", { name: "Payment security decision" });
    // An amount this far outside the behavioral baseline reliably reaches
    // HIGH or CRITICAL (an uncapped-growth curve, by design — see the Risk
    // Engine rebuild), so assert on the step-up gate rather than pinning
    // to one specific tier label.
    await expect(dialog.getByText("Step-up verification required")).toBeVisible();
    await expect(dialog.getByText(/Verification Required|Status/i)).toBeVisible();

    await dialog.getByRole("button", { name: "Review & verify" }).click();
    await page.waitForURL("**/verify/session/**");

    // High-Risk Verification panel: score, triggered rules, and the
    // Cancel/Verify Identity decision point.
    await expect(page.getByText("High-risk transaction detected")).toBeVisible();
    await page.getByRole("button", { name: "Verify identity" }).click();

    // No WebAuthn credential registered in this fresh browser context, so
    // the flow falls back to the password step-up gate.
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Verify and continue" }).click();

    // Identity confirmed — CB-OTP is generated and (in this no-email-provider
    // demo configuration) surfaced directly so the flow can be completed.
    await expect(page.getByText("Identity verified")).toBeVisible();
    const demoCodeLocator = page.locator("span.font-mono.font-semibold.tabular-nums");
    const demoCode = (await demoCodeLocator.textContent())?.trim();
    expect(demoCode).toMatch(/^\d{6}$/);

    await page.getByRole("button", { name: "Continue to code entry" }).click();
    await page.waitForURL("**/verify/otp**");

    await page.getByRole("textbox", { name: "6-digit verification code" }).pressSequentially(demoCode!);
    await page.getByRole("button", { name: "Verify and approve" }).click();

    await expect(page.getByText("Transaction approved")).toBeVisible();
  });

  test("cancelling a high-risk transaction denies it without ever issuing an OTP", async ({ page }) => {
    for (let i = 0; i < 3; i += 1) {
      await simulatePayment(page, { merchant: `Warm-up Merchant B${i}`, amount: "150" });
      await closeSimulateDialog(page);
    }

    await page.goto("/dev/context-simulator");
    await page.getByRole("button", { name: "Trigger" }).nth(1).click();
    await expect(page.getByText("Signal injected")).toBeVisible();
    await page.getByRole("button", { name: "Trigger" }).nth(2).click();

    await page.goto("/dashboard");
    const merchant = `Unfamiliar Wire Desk Cancel ${Date.now()}`;
    await simulatePayment(page, { merchant, amount: "500000" });

    const dialog = page.getByRole("dialog", { name: "Payment security decision" });
    await dialog.getByRole("button", { name: "Review & verify" }).click();
    await page.waitForURL("**/verify/session/**");

    await page.getByRole("button", { name: "Cancel transaction" }).click();
    await expect(page.getByText("Transaction cancelled")).toBeVisible();

    await page.getByRole("button", { name: "View transaction" }).click();
    await expect(page.getByText("DENIED")).toBeVisible();
  });
});
