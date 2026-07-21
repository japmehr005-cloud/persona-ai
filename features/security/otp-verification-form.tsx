"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import { verifyOtpAction, type VerifyOtpActionResult } from "@/features/security/otp-actions";
import { OtpTimer } from "@/features/security/otp-timer";
import {
  OtpLifecycleStepper,
  type OtpLifecycleFailure,
  type OtpLifecycleStage,
} from "@/components/shared/otp-lifecycle-stepper";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const FAILURE_MESSAGES: Record<NonNullable<VerifyOtpActionResult["reason"]>, string> = {
  "not-found": "We couldn't find this verification challenge.",
  expired: "This code has expired and the transaction was not completed.",
  "max-attempts": "Too many incorrect attempts. The transaction was denied.",
  "invalid-code": "That code doesn't match. Check the code and try again.",
  "rate-limited": "Too many verification attempts. Please wait a couple of minutes and try again.",
};

type TerminalState = "approved" | "denied" | "expired" | "already-verified" | "inactive" | null;

/** Maps this form's terminal state to the CB-OTP lifecycle stage/failure
 * shown by the shared stepper. By the time this form is mounted, the
 * session is already Created → Device Verified → OTP Generated (the
 * High-Risk Verification flow completed those stages before ever issuing
 * this challenge), so the stepper only needs to resolve the final two. */
function lifecycleFor(terminalState: TerminalState): {
  stage: OtpLifecycleStage;
  failure: OtpLifecycleFailure | null;
} {
  switch (terminalState) {
    case "approved":
    case "already-verified":
      return { stage: "transfer-complete", failure: null };
    case "expired":
      return { stage: "otp-generated", failure: "expired" };
    case "denied":
    case "inactive":
      return { stage: "otp-generated", failure: "rejected" };
    default:
      return { stage: "otp-generated", failure: null };
  }
}

/** Maps the challenge's status at initial page load to a terminal state, for
 * cases where the user revisits a link for a challenge that was already
 * resolved in a previous session (as opposed to `terminalState` transitions
 * set below, which reflect an action the user just took in this session). */
function initialTerminalState(status: "PENDING" | "VERIFIED" | "EXPIRED" | "FAILED"): TerminalState {
  switch (status) {
    case "VERIFIED":
      return "already-verified";
    case "EXPIRED":
      return "expired";
    case "FAILED":
      return "inactive";
    default:
      return null;
  }
}

export function OtpVerificationForm({
  challengeId,
  expiresAt,
  attemptsRemaining: initialAttemptsRemaining,
  transactionId,
  initialStatus,
}: {
  challengeId: string;
  expiresAt: Date;
  attemptsRemaining: number;
  transactionId: string;
  initialStatus: "PENDING" | "VERIFIED" | "EXPIRED" | "FAILED";
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(initialAttemptsRemaining);
  // Initialized once from the server-provided status and never re-derived
  // from prop changes, so a background Router Cache refresh triggered by the
  // verify action's own revalidation can't clobber a just-set "approved"
  // state with a stale "already verified" read of the (now updated) record.
  const [terminalState, setTerminalState] = useState<TerminalState>(() => initialTerminalState(initialStatus));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return;

    setIsSubmitting(true);
    setError(null);
    const result = await verifyOtpAction(challengeId, code);
    setIsSubmitting(false);

    if (result.ok) {
      setTerminalState("approved");
      return;
    }

    if (result.reason === "max-attempts") {
      setTerminalState("denied");
      return;
    }
    if (result.reason === "expired") {
      setTerminalState("expired");
      return;
    }

    setError(FAILURE_MESSAGES[result.reason ?? "invalid-code"]);
    if (result.attemptsRemaining !== undefined) setAttemptsRemaining(result.attemptsRemaining);
    setCode("");
  };

  const { stage, failure } = lifecycleFor(terminalState);
  const stepper = <OtpLifecycleStepper currentStage={stage} failure={failure} />;

  if (terminalState === "approved") {
    return (
      <div className="space-y-5">
        {stepper}
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Transaction approved</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Verification succeeded and the transaction has been completed.
            </p>
          </div>
          <Button onClick={() => router.push(`/transactions/${transactionId}`)}>View transaction</Button>
        </div>
      </div>
    );
  }

  if (terminalState === "denied" || terminalState === "expired") {
    return (
      <div className="space-y-5">
        {stepper}
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {terminalState === "expired" ? "Verification expired" : "Transaction denied"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {terminalState === "expired"
                ? "The code expired before it was verified, so the transaction was not completed."
                : "Too many incorrect attempts. For your protection, this transaction was not completed."}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/transactions/${transactionId}`)}>
            View transaction
          </Button>
        </div>
      </div>
    );
  }

  if (terminalState === "already-verified" || terminalState === "inactive") {
    return (
      <div className="space-y-5">
        {stepper}
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShieldAlert className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {terminalState === "already-verified" ? "Already verified" : "Verification failed"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {terminalState === "already-verified"
                ? "This transaction was already verified and approved."
                : "This verification challenge is no longer active. Check the transaction for its current status."}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/transactions/${transactionId}`)}>
            View transaction
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {stepper}
      <div className="flex flex-col items-center gap-3">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          disabled={isSubmitting}
          aria-label="6-digit verification code"
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot key={index} index={index} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <OtpTimer expiresAt={expiresAt} onExpire={() => setTerminalState("expired")} />
      </div>

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
      </p>

      <Button type="submit" className="w-full" disabled={code.length !== 6 || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Verify and approve
      </Button>
    </form>
  );
}
