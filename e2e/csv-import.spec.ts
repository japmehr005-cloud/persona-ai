import { test, expect } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, login } from "./fixtures";

test.describe("CSV statement import", () => {
  test("dashboard reflects an imported statement immediately, without a manual refresh", async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);

    const uniqueMerchant = `E2E Import Verify ${Date.now()}`;
    // A couple of days ahead of "now", so this row unambiguously outranks
    // every other transaction in the "5 most recent" ordering regardless of
    // which timezone the app server vs. this test runner resolves "today"
    // in — the point is proving the *ordering/freshness*, not the exact date.
    const futureIso = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
    const csv = `Date,Description,Amount,Category\n${futureIso},${uniqueMerchant},-777.00,Shopping\n`;

    await page.goto("/transactions/import");
    await page.setInputFiles("#csv-file", {
      name: "e2e-import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText("Map columns and review")).toBeVisible();
    await expect(page.getByText(uniqueMerchant)).toBeVisible();

    await page.getByRole("button", { name: "Import 1 transactions" }).click();
    await expect(page.getByText("Import complete")).toBeVisible();

    // Deliberately a client-side navigation (not page.reload/goto), the
    // exact scenario the dashboard-blank-after-import bug affected: the
    // Router Cache must be invalidated server-side (revalidatePath) for
    // freshly imported data to appear without the customer refreshing.
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await page.waitForURL("**/dashboard");

    await expect(page.getByText(uniqueMerchant)).toBeVisible();
  });
});
