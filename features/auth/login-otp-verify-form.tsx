"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { verifyLoginOtpAction, type VerifyLoginOtpActionState } from "@/lib/auth-actions";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { OtpTimer } from "@/features/security/otp-timer";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const initialState: VerifyLoginOtpActionState = {};

export function LoginOtpVerifyForm({
  challengeId,
  expiresAt,
  attemptsRemaining,
  demoCode,
}: {
  challengeId: string;
  expiresAt: Date;
  attemptsRemaining: number;
  demoCode?: string;
}) {
  const [state, formAction, isPending] = useActionState(verifyLoginOtpAction, initialState);
  const [code, setCode] = useState("");
  const [fingerprintHash, setFingerprintHash] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    getDeviceFingerprint()
      .then((fingerprint) => setFingerprintHash(fingerprint.fingerprintHash))
      .catch(() => {
        /* Device fingerprinting is a defense-in-depth signal, not a
         * hard requirement — a missing hash just skips device binding. */
      });
  }, []);

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-sm font-medium text-foreground">This code has expired</p>
        <p className="text-sm text-muted-foreground">
          For your security, one-time codes expire after 60 seconds. Please sign in again to receive a new
          code.
        </p>
        <Button variant="outline" onClick={() => window.location.assign("/login")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="deviceFingerprintHash" value={fingerprintHash} />

      <div className="flex flex-col items-center gap-3">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          disabled={isPending}
          aria-label="6-digit verification code"
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <OtpTimer expiresAt={expiresAt} onExpire={() => setExpired(true)} />
      </div>

      {demoCode && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-center text-xs text-warning">
          Demo mode — email delivery isn&apos;t configured, so your code is shown here:{" "}
          <span className="font-mono font-semibold tabular-nums">{demoCode}</span>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
      </p>

      <Button type="submit" className="w-full" disabled={code.length !== 6 || isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        Verify and sign in
      </Button>
    </form>
  );
}
