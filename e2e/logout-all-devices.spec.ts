import { test } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, login } from "./fixtures";

test.describe("Logout all devices", () => {
  test("invalidates the current session immediately", async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);

    await page.goto("/settings");
    await page.getByRole("tab", { name: "Sessions" }).click();
    await page.getByRole("button", { name: "Log out all devices" }).click();

    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Log out all devices" }).click();

    await page.waitForURL("**/login");

    // The bumped sessionVersion must reject the old JWT immediately, not
    // just after this browser's own client-side redirect — a direct
    // navigation to a protected route with the same (now stale) cookie
    // must also bounce back to /login rather than rendering the dashboard.
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
  });
});
