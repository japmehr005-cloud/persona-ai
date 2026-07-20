import type { Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@securebank.ai";
export const DEMO_PASSWORD = "demo-password";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

interface SimulatePaymentOptions {
  merchant: string;
  amount: string;
}

/** Opens the "Simulate payment" dialog from the dashboard, submits the form,
 * and waits for the Adaptive Risk Engine's result panel to render. */
export async function simulatePayment(page: Page, options: SimulatePaymentOptions) {
  await page.getByRole("button", { name: "Simulate payment" }).click();
  await page.locator("#sim-merchant").fill(options.merchant);
  await page.locator("#sim-amount").fill(options.amount);
  await page.getByRole("button", { name: "Run risk assessment" }).click();
  await page.getByRole("heading", { name: "Risk assessment result" }).waitFor();
}

export async function closeSimulateDialog(page: Page) {
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
}
