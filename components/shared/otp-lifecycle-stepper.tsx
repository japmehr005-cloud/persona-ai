import { Check, Loader2, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type OtpLifecycleStage =
  | "created"
  | "device-verified"
  | "otp-generated"
  | "otp-verified"
  | "transfer-complete";

export type OtpLifecycleFailure = "expired" | "rejected";

const STAGES: { id: OtpLifecycleStage; label: string }[] = [
  { id: "created", label: "Created" },
  { id: "device-verified", label: "Device verified" },
  { id: "otp-generated", label: "OTP generated" },
  { id: "otp-verified", label: "OTP verified" },
  { id: "transfer-complete", label: "Transfer complete" },
];

const FAILURE_COPY: Record<OtpLifecycleFailure, { title: string; description: string }> = {
  expired: {
    title: "SESSION EXPIRED",
    description: "The verification window elapsed before this step completed. The transaction was not completed.",
  },
  rejected: {
    title: "SESSION REJECTED",
    description: "This transaction was cancelled before verification completed.",
  },
};

/**
 * Visualizes the Context-Bound OTP lifecycle (Created → Device Verified →
 * OTP Generated → OTP Verified → Transfer Complete) so the demo makes the
 * CB-OTP session model — and its failure states — visible rather than
 * implicit. Purely presentational: driven by whatever stage/failure the
 * caller has already derived from server state.
 */
export function OtpLifecycleStepper({
  currentStage,
  failure,
}: {
  currentStage: OtpLifecycleStage;
  failure?: OtpLifecycleFailure | null;
}) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === currentStage);

  return (
    <div className="space-y-3">
      <ol className="flex items-center">
        {STAGES.map((stage, index) => {
          const isComplete = !failure && index < currentIndex;
          const isCurrent = !failure && index === currentIndex;
          const isFailedAt = Boolean(failure) && index === currentIndex;

          return (
            <li key={stage.id} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    isComplete && "border-success bg-success text-success-foreground",
                    isCurrent && "border-accent-foreground bg-accent text-accent-foreground",
                    isFailedAt && "border-destructive bg-destructive/10 text-destructive",
                    !isComplete && !isCurrent && !isFailedAt && "border-border bg-muted text-muted-foreground"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isComplete ? (
                    <Check className="size-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : isFailedAt ? (
                    <ShieldAlert className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "hidden text-center text-[11px] leading-tight sm:block",
                    isComplete || isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                    isFailedAt && "font-medium text-destructive"
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {index < STAGES.length - 1 && (
                <span
                  className={cn(
                    "mx-1.5 h-px flex-1",
                    index < currentIndex && !failure ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {failure && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-xs font-semibold tracking-wide text-destructive">
              {FAILURE_COPY[failure].title}
            </p>
            <p className="text-xs text-muted-foreground">{FAILURE_COPY[failure].description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
