import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface NotificationAlert {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  createdAt: Date;
}

const severityDot: Record<NotificationAlert["severity"], string> = {
  LOW: "bg-muted-foreground",
  MEDIUM: "bg-warning",
  HIGH: "bg-destructive",
};

export function NotificationPopover({ alerts }: { alerts: NotificationAlert[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {alerts.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium">Open alerts</span>
          <Badge variant="outline">{alerts.length}</Badge>
        </div>
        {alerts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No open alerts. We&apos;ll notify you if something looks unusual.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {alerts.map((alert) => (
              <li key={alert.id} className="border-b border-border last:border-0">
                <Link
                  href={`/alerts/${alert.id}`}
                  className="flex items-start gap-2 px-4 py-3 text-sm transition-colors hover:bg-accent"
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${severityDot[alert.severity]}`}
                  />
                  <span className="flex-1">
                    <span className="line-clamp-2 text-foreground">{alert.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/alerts">View all alerts</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
