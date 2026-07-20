import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AdminAlertFeedItem {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  createdAt: Date;
  customerName: string;
}

const SEVERITY_STYLES: Record<AdminAlertFeedItem["severity"], string> = {
  LOW: "text-muted-foreground bg-muted",
  MEDIUM: "text-warning bg-warning/10",
  HIGH: "text-destructive bg-destructive/10",
};

export function AdminAlertFeed({ alerts }: { alerts: AdminAlertFeedItem[] }) {
  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li key={alert.id}>
          <Link
            href={`/admin/alerts`}
            className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                SEVERITY_STYLES[alert.severity]
              )}
            >
              <AlertTriangle className="size-4" />
            </span>
            <span className="flex-1 space-y-0.5">
              <span className="block text-sm font-medium text-foreground">{alert.title}</span>
              <span className="block text-xs text-muted-foreground">
                {alert.customerName} · {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
