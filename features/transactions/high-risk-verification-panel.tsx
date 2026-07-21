"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { Ban, CheckCircle2, Fingerprint, KeyRound, Loader2, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

import {
  cancelVerificationSessionAction,
  finishWebAuthnVerificationAction,
  startWebAuthnVerificationAction,
  verifyPasswordStepUpAction,
  type VerificationStepResult,
} from "@/features/transactions/verification-actions";
import type { VerificationSessionView } from "@/services/transactions/verification-session";
import { ContextBoundSummary } from "@/components/shared/context-bound-summary";
import { RiskBreakdown } from "@/components/shared/risk-breakdown";
import { OtpLifecycleStepper, type OtpLifecycleStage } from "@/components/shared/otp-lifecycle-stepper";
import { OtpTimer } from "@/features/security/otp-timer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FAILURE_MESSAGES: Record<NonNullable<VerificationStepResult["reason"]>, string> = {
  "not-found": "This verification session could not be found.",
  "not-pending": "This session is no longer awaiting verification.",
  expired: "This verification session has expired. The transaction was not completed.",
  "webauthn-failed": "Biometric verification failed or was cancelled. Enter your password instead.",
  "invalid-password": "That password is incorrect. Try again.",
  "rate-limited": "Too many attempts. Please wait a couple of minutes and try again.",
};

type FlowStep = "review" | "device-check" | "password";

export function HighRiskVerificationPanel({ session }: { session: VerificationSessionView }) {
  const router = useRouter();

  const [step, setStep] = useState<FlowStep>("review");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<"rejected" | "expired" | null>(
    session.status === "REJECTED" ? "rejected" : session.status === "EXPIRED" ? "expired" : null
  );
  const [otpResult, setOtpResult] = useState<{ challengeId: string; demoCode?: string } | null>(null);

  const goToOtp = (challengeId: string) => router.push(`/verify/otp?challengeId=${challengeId}`);

  if (otpResult) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Identity verified</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A one-time code bound to this transaction has been generated. Enter it to complete authorization.
            </p>
          </div>
          <OtpLifecycleStepper currentStage="otp-generated" />
          {otpResult.demoCode && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Demo mode — email delivery isn&apos;t configured, so your verification code is shown here:{" "}
              <span className="font-mono font-semibold tabular-nums">{otpResult.demoCode}</span>
            </div>
          )}
          <Button onClick={() => goToOtp(otpResult.challengeId)}>Continue to code entry</Button>
        </CardContent>
      </Card>
    );
  }

  if (terminal) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldX className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {terminal === "rejected" ? "Transaction cancelled" : "Verification session expired"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {terminal === "rejected"
                ? "You cancelled this transaction. It was not completed."
                : "The verification window elapsed before you completed identity verification. The transaction was not completed."}
            </p>
          </div>
          <OtpLifecycleStepper currentStage="created" failure={terminal} />
          <Button variant="outline" onClick={() => router.push(`/transactions/${session.transactionId}`)}>
            View transaction
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (session.status === "VERIFIED") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Identity already verified</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the one-time code that was sent to you to finish authorizing this transaction.
            </p>
          </div>
          {session.pendingOtpChallengeId ? (
            <Button onClick={() => goToOtp(session.pendingOtpChallengeId!)}>Continue to code entry</Button>
          ) : (
            <Button variant="outline" onClick={() => router.push(`/transactions/${session.transactionId}`)}>
              View transaction
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const stage: OtpLifecycleStage = step === "review" ? "created" : "device-verified";

  const handleCancel = async () => {
    setIsCancelling(true);
    setError(null);
    const result = await cancelVerificationSessionAction(session.transactionId);
    setIsCancelling(false);

    if (!result.ok) {
      if (result.reason === "expired") {
        setTerminal("expired");
        return;
      }
      setError(FAILURE_MESSAGES[result.reason ?? "not-found"]);
      return;
    }
    setTerminal("rejected");
  };

  const handleVerifyIdentity = async () => {
    setError(null);
    setStep("device-check");

    if (session.hasWebAuthnCredential) {
      await attemptWebAuthn();
    } else {
      setStep("password");
    }
  };

  const attemptWebAuthn = async () => {
    setIsVerifying(true);
    try {
      const optionsResponse = await startWebAuthnVerificationAction(session.transactionId);
      if (!optionsResponse.ok) {
        setError(FAILURE_MESSAGES[optionsResponse.reason] ?? FAILURE_MESSAGES["webauthn-failed"]);
        setStep("password");
        return;
      }

      let assertion: AuthenticationResponseJSON;
      try {
        assertion = await startAuthentication(optionsResponse.options);
      } catch {
        setError(FAILURE_MESSAGES["webauthn-failed"]);
        setStep("password");
        return;
      }

      const result = await finishWebAuthnVerificationAction(session.transactionId, assertion);
      if (!result.ok) {
        if (result.reason === "expired") {
          setTerminal("expired");
          return;
        }
        setError(FAILURE_MESSAGES[result.reason ?? "webauthn-failed"]);
        setStep("password");
        return;
      }

      setOtpResult({ challengeId: result.otpChallengeId!, demoCode: result.otpDemoCode });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) return;

    setIsVerifying(true);
    setError(null);
    const result = await verifyPasswordStepUpAction(session.transactionId, password);
    setIsVerifying(false);

    if (!result.ok) {
      if (result.reason === "expired") {
        setTerminal("expired");
        return;
      }
      setError(FAILURE_MESSAGES[result.reason ?? "invalid-password"]);
      setPassword("");
      return;
    }

    setOtpResult({ challengeId: result.otpChallengeId!, demoCode: result.otpDemoCode });
  };

  return (
    <div className="space-y-4">
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <CardTitle>High-risk transaction detected</CardTitle>
              <CardDescription>
                This transaction is on hold until you verify your identity.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <OtpLifecycleStepper currentStage={stage} />

          {session.verificationExpiresAt && (
            <div className="flex justify-center">
              <OtpTimer expiresAt={session.verificationExpiresAt} onExpire={() => setTerminal("expired")} />
            </div>
          )}

          <ContextBoundSummary
            merchant={session.merchant}
            amount={-Math.abs(session.amount)}
            beneficiary={session.beneficiary}
            date={session.date}
          />

          <RiskBreakdown
            assessment={{
              score: session.score,
              tier: session.tier,
              confidence: session.confidence,
              explanation: session.explanation,
              otpRequired: true,
              factors: session.factors,
              actualAmount: session.amount,
              baseline: session.baseline,
            }}
          />

          {session.sessionTokenPreview && (
            <p className="text-center text-xs text-muted-foreground">
              Context session <span className="font-mono">{session.sessionTokenPreview}</span> · bound to this
              transaction only
            </p>
          )}

          {step === "device-check" && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <ShieldCheck className={session.deviceTrusted ? "size-4 text-success" : "size-4 text-warning"} />
              {session.deviceTrusted === true && "This device is recognized and trusted."}
              {session.deviceTrusted === false && "This is a new or unrecognized device."}
              {session.deviceTrusted === null && "Device trust could not be determined for this session."}
            </div>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <KeyRound className="size-4" />
                Confirm your password to continue
              </div>
              <div className="space-y-2">
                <Label htmlFor="step-up-password">Password</Label>
                <Input
                  id="step-up-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isVerifying}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={!password || isVerifying}>
                {isVerifying && <Loader2 className="animate-spin" />}
                Verify and continue
              </Button>
            </form>
          )}

          {error && (
            <p role="alert" className="text-center text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {step === "review" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleCancel} disabled={isCancelling}>
            {isCancelling && <Loader2 className="animate-spin" />}
            <Ban className="size-4" />
            Cancel transaction
          </Button>
          <Button onClick={handleVerifyIdentity} disabled={isVerifying}>
            {isVerifying ? <Loader2 className="animate-spin" /> : <Fingerprint className="size-4" />}
            Verify identity
          </Button>
        </div>
      )}
    </div>
  );
}
