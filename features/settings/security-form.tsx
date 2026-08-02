"use client";

import { useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";

import { updateSecurityPreferencesAction } from "@/features/settings/settings-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TwoFactorSection } from "@/features/settings/two-factor-section";
import { BiometricSection } from "@/features/settings/biometric-section";
import { SignInMethodSection } from "@/features/settings/sign-in-method-section";
import type { WebAuthnCredentialView } from "@/services/auth/webauthn";
import type { PreferredAuthMethod } from "@prisma/client";

export function SecurityForm({
  emailAlertsEnabled,
  smsAlertsEnabled,
  twoFactorEnabled,
  webAuthnCredentials,
  preferredAuthMethod,
}: {
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  twoFactorEnabled: boolean;
  webAuthnCredentials: WebAuthnCredentialView[];
  preferredAuthMethod: PreferredAuthMethod | null;
}) {
  const [values, setValues] = useState({ emailAlertsEnabled, smsAlertsEnabled });
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (key: keyof typeof values, next: boolean) => {
    const updated = { ...values, [key]: next };
    setValues(updated);
    setIsSaving(true);
    const response = await updateSecurityPreferencesAction(updated);
    setIsSaving(false);

    if (!response.ok) {
      toast.error(response.error);
      setValues(values);
      return;
    }
    toast.success("Security preferences updated.");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sign-in method</CardTitle>
          <CardDescription>
            Choose how Persona AI verifies you every time you sign in. A riskier-than-usual sign-in can
            still require a stronger method than the one you pick here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInMethodSection
            currentMethod={preferredAuthMethod}
            hasBiometricCredential={webAuthnCredentials.length > 0}
            hasAuthenticatorEnabled={twoFactorEnabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Require a time-based one-time code from an authenticator app when signing in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSection enabled={twoFactorEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Biometric verification</CardTitle>
          <CardDescription>
            Use your device&apos;s fingerprint, face, or security key to verify high-risk transactions
            instead of a password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BiometricSection credentials={webAuthnCredentials} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert preferences</CardTitle>
          <CardDescription>Choose how Persona AI notifies you about account activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="email-alerts" className="text-sm font-medium text-foreground">
                Email alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive an email for step-up verification codes and high-risk transaction alerts.
              </p>
            </div>
            <Switch
              id="email-alerts"
              checked={values.emailAlertsEnabled}
              disabled={isSaving}
              onCheckedChange={(checked) => handleToggle("emailAlertsEnabled", checked)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="sms-alerts" className="text-sm font-medium text-foreground">
                SMS alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive a text message for the same events (demo only — no SMS gateway is configured).
              </p>
            </div>
            <Switch
              id="sms-alerts"
              checked={values.smsAlertsEnabled}
              disabled={isSaving}
              onCheckedChange={(checked) => handleToggle("smsAlertsEnabled", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trusted devices</CardTitle>
          <CardDescription>Manage which devices and sessions are recognized as yours.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/security/devices">
              <Fingerprint />
              Manage devices &amp; sessions
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
