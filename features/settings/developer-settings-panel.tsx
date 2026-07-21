"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  resetDemoDataAction,
  updateDeveloperSettingsAction,
} from "@/features/settings/settings-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeveloperSettingsPanel({
  showRiskDebugPanel,
  isDemo,
}: {
  showRiskDebugPanel: boolean;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [debugPanelEnabled, setDebugPanelEnabled] = useState(showRiskDebugPanel);
  const [isSavingToggle, setIsSavingToggle] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleToggleDebugPanel = async (checked: boolean) => {
    setDebugPanelEnabled(checked);
    setIsSavingToggle(true);
    const response = await updateDeveloperSettingsAction({ showRiskDebugPanel: checked });
    setIsSavingToggle(false);

    if (!response.ok) {
      toast.error(response.error);
      setDebugPanelEnabled(!checked);
      return;
    }
    toast.success("Developer settings updated.");
  };

  const handleReset = async () => {
    setIsResetting(true);
    const response = await resetDemoDataAction();
    setIsResetting(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success(`Regenerated ${response.data.importedCount} demo transactions.`);
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Risk Engine debug panel</CardTitle>
          <CardDescription>
            Show the raw factor weights and contributions behind every risk assessment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="risk-debug-panel" className="text-sm font-medium text-foreground">
                Show debug panel
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds a technical breakdown to the risk explanation panel across the app.
              </p>
            </div>
            <Switch
              id="risk-debug-panel"
              checked={debugPanelEnabled}
              disabled={isSavingToggle}
              onCheckedChange={handleToggleDebugPanel}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test data</CardTitle>
          <CardDescription>
            {isDemo
              ? "Wipe and regenerate this demo account's transaction history and behavioral baseline."
              : "Test data reset is only available for demo accounts."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={!isDemo || isResetting}>
                {isResetting ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Reset test data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset demo transaction history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all transactions, alerts, and the behavioral baseline for this
                  account, then regenerates ~100 days of synthetic history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isResetting}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleReset();
                  }}
                >
                  {isResetting && <Loader2 className="animate-spin" />}
                  Reset test data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
