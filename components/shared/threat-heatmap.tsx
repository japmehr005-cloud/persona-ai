"use client";

import type { ThreatHeatmapCell } from "@/services/admin/get-fin-overview";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW"] as const;

const INTENSITY_STEPS = [
  "bg-muted",
  "bg-warning/15",
  "bg-warning/35",
  "bg-destructive/45",
  "bg-destructive/70",
  "bg-destructive",
];

function intensityClass(count: number, max: number): string {
  if (count === 0 || max === 0) return INTENSITY_STEPS[0];
  const ratio = count / max;
  const step = Math.min(INTENSITY_STEPS.length - 1, Math.ceil(ratio * (INTENSITY_STEPS.length - 1)));
  return INTENSITY_STEPS[Math.max(1, step)];
}

/**
 * A lightweight severity × day grid — Recharts has no native heatmap
 * primitive, and a custom Tailwind grid keeps this consistent with the
 * design system (rounded cells, existing severity color tokens) without
 * pulling in another charting dependency for one chart type.
 */
export function ThreatHeatmap({ data }: { data: ThreatHeatmapCell[] }) {
  const days = Array.from(new Set(data.map((cell) => cell.day)));
  const max = Math.max(1, ...data.map((cell) => cell.count));

  const cellFor = (day: string, severity: string) => data.find((cell) => cell.day === day && cell.severity === severity);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1.5">
          <div className="flex gap-1.5 pl-14">
            {days.map((day) => (
              <div key={day} className="w-9 text-center text-[10px] text-muted-foreground">
                {day.split(" ")[1]}
              </div>
            ))}
          </div>
          {SEVERITY_ORDER.map((severity) => (
            <div key={severity} className="flex items-center gap-1.5">
              <div className="w-12 shrink-0 text-right text-[10px] font-medium text-muted-foreground">
                {severity}
              </div>
              {days.map((day) => {
                const cell = cellFor(day, severity);
                const count = cell?.count ?? 0;
                return (
                  <Tooltip key={`${day}-${severity}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "size-9 rounded-md transition-colors",
                          intensityClass(count, max)
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {count} {severity.toLowerCase()}-severity event{count === 1 ? "" : "s"} on {day}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
