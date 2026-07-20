import { CheckCircle2, ShieldAlert, ShieldQuestion } from "lucide-react";

import { cn } from "@/lib/utils";

export type SecurityStatus = "PROTECTED" | "REVIEW_RECOMMENDED" | "ACTION_REQUIRED";

const STATUS_CONFIG: Record<
  SecurityStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  PROTECTED: {
    label: "Protected",
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
  REVIEW_RECOMMENDED: {
    label: "Review recommended",
    icon: ShieldQuestion,
    className: "bg-warning/10 text-warning",
  },
  ACTION_REQUIRED: {
    label: "Action required",
    icon: ShieldAlert,
    className: "bg-destructive/10 text-destructive",
  },
};

export function SecurityStatusBadge({
  status,
  className,
}: {
  status: SecurityStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium",
        config.className,
        className
      )}
    >
      <Icon className="size-4" />
      {config.label}
    </span>
  );
}

export function deriveSecurityStatus(params: {
  openHighAlerts: number;
  openMediumAlerts: number;
}): SecurityStatus {
  if (params.openHighAlerts > 0) return "ACTION_REQUIRED";
  if (params.openMediumAlerts > 0) return "REVIEW_RECOMMENDED";
  return "PROTECTED";
}
