import { test, expect } from "@playwright/test";

import { DEMO_EMAIL, DEMO_PASSWORD, login } from "./fixtures";

test.describe("WebAuthn biometric verification", () => {
  test("registers a platform authenticator and can remove it again", async ({ page, context }) => {
    // Real hardware fingerprint/face sensors don't exist in CI, so this uses
    // Chrome DevTools Protocol's virtual authenticator — the same approach
    // documented in the architecture plan for automated biometric coverage.
    const client = await context.newCDPSession(page);
    await client.send("WebAuthn.enable");
    const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Security" }).click();
    await expect(page.getByText("Platform authenticator")).toBeVisible();
    await expect(page.getByText("Not yet registered.")).toBeVisible();

    await page.getByRole("button", { name: "Add device" }).click();
    const registerDialog = page.getByRole("dialog", { name: "Register this device" });
    await registerDialog.getByLabel("Device name").fill("CI Virtual Authenticator");
    await registerDialog.getByRole("button", { name: "Continue with biometric prompt" }).click();

    await expect(page.getByText("Device registered for biometric verification.")).toBeVisible();
    await expect(page.getByText("1 registered credential.")).toBeVisible();
    await expect(page.getByText("CI Virtual Authenticator")).toBeVisible();

    await page.getByRole("button", { name: "Remove credential" }).click();
    await expect(page.getByText("Credential removed.")).toBeVisible();
    await expect(page.getByText("Not yet registered.")).toBeVisible();

    await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  });
});
