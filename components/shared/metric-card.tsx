import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  delta?: { value: string; direction: "up" | "down"; tone?: "positive" | "negative" | "neutral" };
  helperText?: string;
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, delta, helperText, className }: MetricCardProps) {
  return (
    <Card className={cn("py-6", className)}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {(delta || helperText) && (
            <p className="flex items-center gap-1 text-xs">
              {delta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    delta.tone === "negative"
                      ? "text-destructive"
                      : delta.tone === "neutral"
                        ? "text-muted-foreground"
                        : "text-success"
                  )}
                >
                  {delta.direction === "up" ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  )}
                  {delta.value}
                </span>
              )}
              {helperText && <span className="text-muted-foreground">{helperText}</span>}
            </p>
          )}
        </div>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4.5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
