"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { RiskBreakdown, type RiskAssessmentView } from "@/components/shared/risk-breakdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RiskBreakdownDialog({
  assessment,
  trigger,
}: {
  assessment: RiskAssessmentView | null;
  trigger?: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <ShieldAlert className="size-4" />
            Risk breakdown
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Risk breakdown</DialogTitle>
          <DialogDescription>
            Factor-level detail from the Adaptive Risk Engine for this transaction.
          </DialogDescription>
        </DialogHeader>
        <RiskBreakdown assessment={assessment} />
      </DialogContent>
    </Dialog>
  );
}
