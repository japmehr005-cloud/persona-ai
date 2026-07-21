"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateRiskEngineSettingsAction } from "@/features/settings/settings-actions";
import { RISK_THRESHOLD_BOUNDS, CRITICAL_RISK_MIN } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function RiskEngineForm({
  adaptiveLearningEnabled,
  mediumRiskThreshold,
  highRiskThreshold,
  riskEngineDemoMode,
}: {
  adaptiveLearningEnabled: boolean;
  mediumRiskThreshold: number;
  highRiskThreshold: number;
  riskEngineDemoMode: boolean;
}) {
  const [values, setValues] = useState({
    adaptiveLearningEnabled,
    mediumRiskThreshold,
    highRiskThreshold,
    riskEngineDemoMode,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await updateRiskEngineSettingsAction(values);
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setValues((prev) => ({ ...prev, ...response.data }));
    toast.success("Risk engine settings updated.");
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Risk Engine</CardTitle>
          <CardDescription>
            Tune how sensitive the Adaptive Behavioral Risk Engine is to your own spending patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="adaptive-learning" className="text-sm font-medium text-foreground">
                Adaptive learning
              </Label>
              <p className="text-xs text-muted-foreground">
                Let Persona AI keep refining your behavioral baseline as new transactions arrive.
              </p>
            </div>
            <Switch
              id="adaptive-learning"
              checked={values.adaptiveLearningEnabled}
              onCheckedChange={(checked) => setValues((prev) => ({ ...prev, adaptiveLearningEnabled: checked }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="medium-threshold">Medium risk threshold</Label>
              <span className="text-sm font-medium tabular-nums text-foreground">
                {values.mediumRiskThreshold}
              </span>
            </div>
            <Slider
              id="medium-threshold"
              min={RISK_THRESHOLD_BOUNDS.medium.min}
              max={RISK_THRESHOLD_BOUNDS.medium.max}
              step={1}
              value={[values.mediumRiskThreshold]}
              onValueChange={([next]) =>
                setValues((prev) => ({
                  ...prev,
                  mediumRiskThreshold: next,
                  highRiskThreshold: Math.max(prev.highRiskThreshold, next + 1),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Scores at or above this level are flagged as Medium risk. Lower this to flag more transactions for
              review.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="high-threshold">High risk threshold</Label>
              <span className="text-sm font-medium tabular-nums text-foreground">{values.highRiskThreshold}</span>
            </div>
            <Slider
              id="high-threshold"
              min={Math.max(RISK_THRESHOLD_BOUNDS.high.min, values.mediumRiskThreshold + 1)}
              max={RISK_THRESHOLD_BOUNDS.high.max}
              step={1}
              value={[values.highRiskThreshold]}
              onValueChange={([next]) => setValues((prev) => ({ ...prev, highRiskThreshold: next }))}
            />
            <p className="text-xs text-muted-foreground">
              Scores at or above this level open the High-Risk Verification flow and require step-up
              authentication before completing. Scores of {CRITICAL_RISK_MIN}+ are always Critical, regardless of
              this setting.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="demo-mode" className="text-sm font-medium text-foreground">
                Demo mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Unlock the Context Signal Simulator for injecting mock fraud signals into your own account.
              </p>
            </div>
            <Switch
              id="demo-mode"
              checked={values.riskEngineDemoMode}
              onCheckedChange={(checked) => setValues((prev) => ({ ...prev, riskEngineDemoMode: checked }))}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
