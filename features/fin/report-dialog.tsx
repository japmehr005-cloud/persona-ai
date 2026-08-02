"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { submitFraudReportAction } from "@/features/fin/fraud-report-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ReportType = "SUSPICIOUS_LOGIN" | "SUSPICIOUS_TRANSACTION" | "SUSPICIOUS_BENEFICIARY" | "NOT_ME";

const REPORT_COPY: Record<ReportType, { title: string; description: string; placeholder: string }> = {
  SUSPICIOUS_LOGIN: {
    title: "Report suspicious login",
    description:
      "Tell us what looked wrong about this sign-in. Our Fraud Intelligence Network will investigate immediately.",
    placeholder: "e.g. I don't recognize this device or location.",
  },
  SUSPICIOUS_TRANSACTION: {
    title: "Report suspicious transaction",
    description: "Let us know why this transaction looks suspicious so we can investigate right away.",
    placeholder: "e.g. I didn't authorize this payment.",
  },
  SUSPICIOUS_BENEFICIARY: {
    title: "Report suspicious beneficiary",
    description: "Flag this recipient if you believe they're involved in fraud.",
    placeholder: "e.g. This account asked me to make an unusual payment.",
  },
  NOT_ME: {
    title: "This wasn't me",
    description:
      "We'll immediately flag this activity, tighten security on your account, and open a Fraud Intelligence Network case.",
    placeholder: "Add any details that might help our investigation (optional).",
  },
};

interface ReportDialogProps {
  type: ReportType;
  transactionId?: string;
  sessionId?: string;
  deviceId?: string;
  beneficiary?: string;
  trigger: React.ReactNode;
}

export function ReportDialog({ type, transactionId, sessionId, deviceId, beneficiary, trigger }: ReportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copy = REPORT_COPY[type];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await submitFraudReportAction({
      type,
      description: description.trim() || undefined,
      transactionId,
      sessionId,
      deviceId,
      beneficiary,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    setOpen(false);
    setDescription("");
    toast.success("Report submitted. Our Fraud Intelligence Network is on it.");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="report-description">Details {type !== "NOT_ME" && "(optional)"}</Label>
          <Textarea
            id="report-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={copy.placeholder}
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
