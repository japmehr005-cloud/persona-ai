import { ShieldCheck } from "lucide-react";

import { RiskBadge, type RiskTier } from "@/components/shared/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";

export interface RiskFactorView {
  code: string;
  label: string;
  detail: string;
  contribution: number;
}

export interface RiskAssessmentView {
  score: number;
  tier: RiskTier;
  explanation: string;
  otpRequired: boolean;
  factors: RiskFactorView[];
}

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {assessment.score}
          </span>
          <RiskBadge tier={assessment.tier} />
        </div>
        {assessment.otpRequired && (
          <span className="text-xs font-medium text-muted-foreground">
            Step-up verification required
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{assessment.explanation}</p>

      {assessment.factors.length > 0 && (
        <div className="space-y-3">
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
    </div>
  );
}
