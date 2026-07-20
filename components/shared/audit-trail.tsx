import { format } from "date-fns";
import { History } from "lucide-react";

import type { AuditTrailEntry } from "@/services/audit/get-audit-trail";
import { EmptyState } from "@/components/shared/empty-state";

const ACTION_LABELS: Record<string, string> = {
  OTP_CHALLENGE_CREATED: "Step-up verification requested",
  OTP_CHALLENGE_EXPIRED: "Step-up verification expired",
  OTP_VERIFIED_APPROVED: "Step-up verification completed",
  OTP_MAX_ATTEMPTS_DENIED: "Step-up verification failed (max attempts)",
  ANALYST_APPROVED_TRANSACTION: "Transaction approved by analyst",
  ANALYST_DENIED_TRANSACTION: "Transaction denied by analyst",
  ANALYST_SET_ALERT_DISPOSITION: "Alert disposition updated",
};

export function AuditTrail({ entries }: { entries: AuditTrailEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState icon={History} title="No activity yet" description="Events for this record will appear here." />
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground">{ACTION_LABELS[entry.action] ?? entry.action}</p>
            <p className="text-xs text-muted-foreground">
              {format(entry.createdAt, "MMM d, yyyy 'at' h:mm a")}
              {entry.actorName && ` · ${entry.actorName}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
