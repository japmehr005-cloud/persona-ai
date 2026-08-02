import { ShieldCheck } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { RiskBadge, type RiskTier } from "@/components/shared/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";

export interface RiskFactorView {
  code: string;
  label: string;
  detail: string;
  contribution: number;
}

export interface RiskBaselineView {
  avgAmount: number | null;
  p95Amount: number | null;
  medianAmount: number | null;
  sampleSize: number | null;
}

export interface RiskAssessmentView {
  score: number;
  tier: RiskTier;
  confidence?: number;
  explanation: string;
  otpRequired: boolean;
  factors: RiskFactorView[];
  /** Plain-language recommended action from the Risk Engine. Falls back to
   * a tier-based default for historical rows scored before this field
   * existed. */
  recommendation?: string | null;
  /** Actual amount of the transaction being explained — enables the
   * "Actual vs. expected" comparison from the explainability requirements. */
  actualAmount?: number;
  /** Behavioral baseline snapshot (captured at scoring time). Omitted for
   * historical/imported transactions, which are never scored. */
  baseline?: RiskBaselineView;
}

/** Fallback only — used when `assessment.recommendation` is null, which
 * happens solely for historical rows scored before the Risk Engine started
 * returning a dynamic, factor-aware recommendation (see `risk-scorer.ts`). */
const FALLBACK_RECOMMENDED_ACTION: Record<RiskTier, string> = {
  LOW: "Approved automatically. No additional action required.",
  MEDIUM: "Approved, and flagged for analyst review — no customer action required.",
  HIGH: "Blocked pending identity verification. A one-time code is issued only after identity is confirmed.",
  CRITICAL:
    "Blocked pending identity verification. Treated as the highest-severity tier — a one-time code is issued only after identity is confirmed.",
};

/**
 * Shared explainability surface for a risk assessment: score, tier,
 * confidence, behavioral baseline vs. actual amount, triggered rules, AI
 * explanation, and the recommended action. Reused by the simulate-payment
 * dialog, the High-Risk Verification panel, and the transaction detail
 * page — one component, no duplication.
 */
export function RiskBreakdown({ assessment }: { assessment: RiskAssessmentView | null }) {
  if (!assessment) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Not risk-assessed"
        description="Imported statement transactions are historical and are not scored retroactively. Live and simulated transactions are evaluated in real time by the Adaptive Risk Engine."
      />
    );
  }

  const baseline = assessment.baseline;
  const hasBaseline =
    baseline && (baseline.avgAmount !== null || baseline.p95Amount !== null || baseline.medianAmount !== null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {assessment.score}
          </span>
          <RiskBadge tier={assessment.tier} />
        </div>
        <div className="flex items-center gap-3">
          {typeof assessment.confidence === "number" && (
            <span className="text-xs text-muted-foreground">{assessment.confidence}% confidence</span>
          )}
          {assessment.otpRequired && (
            <span className="text-xs font-medium text-muted-foreground">
              Step-up verification required
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{assessment.explanation}</p>

      {(hasBaseline || typeof assessment.actualAmount === "number") && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:grid-cols-4">
          {typeof assessment.actualAmount === "number" && (
            <BaselineStat label="Actual amount" value={formatCurrency(Math.abs(assessment.actualAmount))} />
          )}
          {baseline?.medianAmount !== null && baseline?.medianAmount !== undefined && (
            <BaselineStat label="Behavioral baseline" value={formatCurrency(baseline.medianAmount)} />
          )}
          {baseline?.avgAmount !== null &&
            baseline?.avgAmount !== undefined &&
            baseline?.p95Amount !== null &&
            baseline?.p95Amount !== undefined && (
              <BaselineStat
                label="Expected range"
                value={`${formatCurrency(baseline.avgAmount)} – ${formatCurrency(baseline.p95Amount)}`}
              />
            )}
          {typeof baseline?.sampleSize === "number" && (
            <BaselineStat label="Based on" value={`${baseline.sampleSize} transactions`} />
          )}
        </div>
      )}

      {assessment.factors.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Triggered rules
          </p>
          {assessment.factors.map((factor) => (
            <div key={factor.code} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{factor.label}</span>
                <span className="text-muted-foreground">+{factor.contribution}</span>
              </div>
              <Progress value={factor.contribution} />
              <p className="text-xs text-muted-foreground">{factor.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recommended action
        </p>
        <p className="mt-1 text-sm text-foreground">
          {assessment.recommendation ?? FALLBACK_RECOMMENDED_ACTION[assessment.tier]}
        </p>
      </div>
    </div>
  );
}

function BaselineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}
