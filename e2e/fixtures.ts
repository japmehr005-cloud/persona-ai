import type { Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@securebank.ai";
export const DEMO_PASSWORD = "demo-password";

/** Selects a sign-in method card on the redesigned login chooser. */
export async function chooseSignInMethod(
  page: Page,
  method: "Password + OTP" | "Password + Biometrics" | "Authenticator app" = "Password + OTP"
) {
  await page.getByRole("button", { name: new RegExp(method, "i") }).click();
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await chooseSignInMethod(page, "Password + OTP");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  // Password + OTP redirects to the verify-otp page for demo accounts.
  await page.waitForURL(/\/(dashboard|login\/verify-otp)/);
  if (page.url().includes("/login/verify-otp")) {
    const demoCode = new URL(page.url()).searchParams.get("demoCode");
    if (demoCode) {
      await page.getByRole("textbox").first().pressSequentially(demoCode);
    }
    await page.getByRole("button", { name: "Verify and sign in" }).click();
  }

  await page.waitForURL("**/dashboard");
}

interface SimulatePaymentOptions {
  merchant: string;
  amount: string;
  /** When Social Engineering Protection pauses, acknowledge and continue. */
  continueAnywayIfPaused?: boolean;
}

/** Opens the "Simulate payment" dialog from the dashboard, submits the form,
 * and waits for the security decision panel (or SE pause) to render. */
export async function simulatePayment(page: Page, options: SimulatePaymentOptions) {
  await page.getByRole("button", { name: "Simulate payment" }).click();
  await page.locator("#sim-merchant").fill(options.merchant);
  await page.locator("#sim-amount").fill(options.amount);
  await page.getByRole("button", { name: "Analyse payment" }).click();

  const paused = page.getByRole("heading", { name: "Potential Social Engineering Attack" });
  const decision = page.getByRole("heading", { name: "Payment security decision" });

  await Promise.race([
    paused.waitFor({ state: "visible" }),
    decision.waitFor({ state: "visible" }),
  ]);

  if (options.continueAnywayIfPaused !== false && (await paused.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Continue Anyway" }).click();
    await decision.waitFor({ state: "visible" });
  }
}

export async function closeSimulateDialog(page: Page) {
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
}
