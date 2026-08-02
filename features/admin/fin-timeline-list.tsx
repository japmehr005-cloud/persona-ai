"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, ShieldAlert } from "lucide-react";

import type { FinEventView } from "@/services/fin/fin-event-logger";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SEVERITY_STYLES: Record<FinEventView["severity"], string> = {
  LOW: "text-muted-foreground bg-muted",
  MEDIUM: "text-warning bg-warning/10",
  HIGH: "text-destructive bg-destructive/10",
};

type SeverityFilter = "ALL" | FinEventView["severity"];

export function FinTimelineList({ events }: { events: FinEventView[] }) {
  const [severity, setSeverity] = useState<SeverityFilter>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      if (severity !== "ALL" && event.severity !== severity) return false;
      if (!normalizedQuery) return true;
      return (
        event.summary.toLowerCase().includes(normalizedQuery) ||
        event.type.toLowerCase().includes(normalizedQuery) ||
        (event.userName?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (event.deviceLabel?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [events, severity, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by customer, device, or event type"
            className="pl-9"
          />
        </div>
        <Select value={severity} onValueChange={(value) => setSeverity(value as SeverityFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All severities</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No matching events"
          description="Try a different search term or severity filter."
        />
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-6">
          {filtered.map((event) => (
            <li key={event.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[29px] flex size-4 items-center justify-center rounded-full ring-4 ring-background",
                  SEVERITY_STYLES[event.severity]
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{event.summary}</p>
                <Badge variant="outline" className="text-[10px]">
                  {event.type.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {event.userName ?? "System"}
                {event.deviceLabel ? ` · ${event.deviceLabel}` : ""} ·{" "}
                {format(event.createdAt, "MMM d, yyyy 'at' h:mm a")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
