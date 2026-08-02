"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { Fingerprint, Loader2 } from "lucide-react";

import {
  finishWebAuthnLoginAction,
  startWebAuthnLoginAction,
  switchToOtpLoginAction,
} from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";

export function WebAuthnLoginForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const optionsResponse = await startWebAuthnLoginAction(token);
      if (!optionsResponse.ok) {
        setError(optionsResponse.error);
        return;
      }

      let assertion: AuthenticationResponseJSON;
      try {
        assertion = await startAuthentication(optionsResponse.options);
      } catch {
        setError("Biometric verification was cancelled or is unavailable on this device.");
        return;
      }

      const result = await finishWebAuthnLoginAction(token, assertion);
      if (result.error) setError(result.error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSwitchToOtp = async () => {
    setIsSwitching(true);
    setError(null);
    const result = await switchToOtpLoginAction(token);
    if (!result.ok) {
      setIsSwitching(false);
      setError(result.error);
      return;
    }
    router.push(result.redirectTo);
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleVerify} className="w-full" disabled={isVerifying || isSwitching}>
        {isVerifying ? <Loader2 className="animate-spin" /> : <Fingerprint className="size-4" />}
        Verify with biometrics
      </Button>

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="link"
        className="w-full text-muted-foreground"
        onClick={handleSwitchToOtp}
        disabled={isVerifying || isSwitching}
      >
        {isSwitching && <Loader2 className="animate-spin" />}
        Can&apos;t use biometrics? Send a one-time code instead
      </Button>
    </div>
  );
}
