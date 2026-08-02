import { AlertTriangle, Flag, Landmark, Network } from "lucide-react";

import type { FinOverviewMetrics } from "@/services/admin/get-fin-overview";
import { cn } from "@/lib/utils";

interface KpiChipProps {
  icon: typeof Flag;
  label: string;
  value: number;
  emphasize?: boolean;
}

function KpiChip({ icon: Icon, label, value, emphasize }: KpiChipProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-none",
        emphasize && value > 0 && "border-destructive/30 bg-destructive/5"
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground",
          emphasize && value > 0 && "bg-destructive/10 text-destructive"
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums leading-none text-foreground">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Compact KPI strip for the SOC header — secondary to the threat map. */
export function SocThreatStatsPanel({ stats }: { stats: FinOverviewMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Threat summary">
      <KpiChip icon={Flag} label="Open reports" value={stats.openFraudReports} emphasize />
      <KpiChip icon={AlertTriangle} label="Confirmed fraud" value={stats.confirmedFraudReports} emphasize />
      <KpiChip icon={Network} label="Active clusters" value={stats.activeClusters} />
      <KpiChip icon={Landmark} label="Gov hits" value={stats.governmentHits} emphasize />
    </div>
  );
}
