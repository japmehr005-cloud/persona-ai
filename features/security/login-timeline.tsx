"use client";

import { format } from "date-fns";
import { MapPin, MonitorSmartphone } from "lucide-react";

import type { SecurityMapMarker } from "@/services/fin/geo-intelligence";
import { RISK_COLOR_HEX } from "@/lib/fin-labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccessibilityOptional } from "@/features/accessibility/accessibility-provider";

export interface LoginTimelineProps {
  markers: SecurityMapMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Chronological companion to `SecurityMap` — dense feed for the floating
 * rail / bottom sheet. Selecting a row drives the same `selectedId` as a
 * marker click. Sequence numbers match map markers and the detail drawer.
 */
export function LoginTimeline({ markers, selectedId, onSelect, className }: LoginTimelineProps) {
  const a11y = useAccessibilityOptional();
  const large = a11y?.largeText || a11y?.seniorMode;

  return (
    <ScrollArea className={cn("h-full", className)}>
      <ol className="divide-y divide-white/10">
        {markers.map((marker) => {
          const isSelected = marker.id === selectedId;
          const tone = RISK_COLOR_HEX[marker.riskColor];

          return (
            <li key={marker.id}>
              <button
                type="button"
                onClick={() => onSelect(marker.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 text-left transition-colors hover:bg-white/5",
                  large ? "min-h-16 gap-4 px-4 py-4" : "py-3",
                  isSelected && "bg-sky-500/10 ring-1 ring-inset ring-sky-400/30"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
                    large ? "size-10 text-sm" : "size-7 text-xs",
                    isSelected && "ring-2 ring-offset-1 ring-offset-[#0b1220]"
                  )}
                  style={{
                    backgroundColor: `${tone}22`,
                    color: tone,
                    boxShadow: isSelected ? `0 0 14px ${tone}66` : undefined,
                    // ring color via CSS variable workaround — use outline for selected
                    outlineColor: isSelected ? tone : undefined,
                  }}
                  aria-label={`Login ${marker.sequenceNumber}`}
                >
                  {marker.sequenceNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={cn("font-medium text-slate-100", large ? "text-base" : "text-sm")}>
                      {marker.isCurrent
                        ? "Current login"
                        : marker.isImpossibleTravel || marker.riskColor === "red"
                          ? "Suspicious login"
                          : marker.riskColor === "green"
                            ? "Trusted login"
                            : "Previous login"}
                    </p>
                    {marker.isCurrent && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-sky-400/40 text-sky-300",
                          large ? "text-xs" : "text-[10px]"
                        )}
                      >
                        Current
                      </Badge>
                    )}
                    {marker.isImpossibleTravel && (
                      <Badge variant="destructive" className={large ? "text-xs" : "text-[10px]"}>
                        Impossible
                      </Badge>
                    )}
                  </div>
                  <p className={cn("mt-0.5 text-slate-400", large ? "text-sm" : "text-xs")}>
                    {format(marker.occurredAt, "MMM d, h:mm a")}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 flex items-center gap-1 truncate text-slate-400",
                      large ? "text-sm" : "text-xs"
                    )}
                  >
                    <MonitorSmartphone className="size-3 shrink-0" />
                    {marker.deviceLabel}
                  </p>
                  {(marker.city || marker.region) && (
                    <p
                      className={cn(
                        "mt-0.5 flex items-center gap-1 truncate text-slate-500",
                        large ? "text-sm" : "text-xs"
                      )}
                    >
                      <MapPin className="size-3 shrink-0" />
                      {[marker.city, marker.region, marker.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
