"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Radio, ShieldAlert } from "lucide-react";

import { getLiveFinEventsAction } from "@/features/admin/fin-actions";
import type { FinEventView } from "@/services/fin/fin-event-logger";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 5000;

const SEVERITY_STYLES: Record<FinEventView["severity"], string> = {
  LOW: "text-muted-foreground bg-muted",
  MEDIUM: "text-warning bg-warning/10",
  HIGH: "text-destructive bg-destructive/10",
};

/**
 * The Admin SOC's live security event stream. Polls the server every 5s
 * for the most recent `FinEvent`s (see `getLiveFinEventsAction`) — this is
 * what makes customer-side actions (login from a new device, a fraud
 * report, a paused transaction) visibly ripple into the SOC in near
 * real time during a live demo.
 */
export function FinLiveEventStream({ initialEvents }: { initialEvents: FinEventView[] }) {
  const [events, setEvents] = useState(initialEvents);
  const knownIds = useRef(new Set(initialEvents.map((event) => event.id)));

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latest = await getLiveFinEventsAction();
        setEvents(latest);
        knownIds.current = new Set(latest.map((event) => event.id));
      } catch {
        // A transient polling failure shouldn't disrupt the SOC view —
        // the next 5s tick will simply retry.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        Live · updates every 5 seconds
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No FIN events yet"
          description="Customer logins, device changes, and fraud reports will stream here in real time."
        />
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <motion.li
                key={event.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    SEVERITY_STYLES[event.severity]
                  )}
                >
                  <ShieldAlert className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{event.summary}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {event.type.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.userName ?? "System"}
                    {event.deviceLabel ? ` · ${event.deviceLabel}` : ""} ·{" "}
                    {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
