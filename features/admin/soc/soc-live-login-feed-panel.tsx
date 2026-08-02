"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, MonitorSmartphone, RadioTower, ShieldCheck, ShieldQuestion } from "lucide-react";

import type { ThreatMapMarker } from "@/services/fin/geo-intelligence";
import { useSocSelectionStore } from "@/stores/soc-selection-store";
import { RISK_COLOR_HEX } from "@/lib/fin-labels";
import { toIncidentId } from "@/lib/incident-id";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const RISK_ICON = { green: ShieldCheck, amber: ShieldQuestion, red: AlertTriangle } as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function SocLiveLoginFeedPanel({ logins }: { logins: ThreatMapMarker[] }) {
  const selection = useSocSelectionStore((state) => state.selection);
  const select = useSocSelectionStore((state) => state.select);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card">
      <header className="shrink-0 border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <RadioTower className="size-4 text-muted-foreground" />
          Live incident feed
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">New logins and flagged sessions</p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <ol className="divide-y divide-border">
          {logins.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No sign-ins recorded yet.</li>
          ) : (
            logins.map((login) => {
              const Icon = RISK_ICON[login.riskColor];
              const isSelected = selection?.type === "session" && selection.id === login.id;
              const tone = RISK_COLOR_HEX[login.riskColor];
              const incidentId = toIncidentId(login.id);

              return (
                <li key={login.id}>
                  <button
                    type="button"
                    onClick={() =>
                      select({
                        type: "session",
                        id: login.id,
                        label: `${incidentId} · ${login.userName}`,
                      })
                    }
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                      isSelected && "bg-accent"
                    )}
                  >
                    <span
                      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${tone}1a`,
                        color: tone,
                      }}
                      aria-hidden
                    >
                      {initials(login.userName)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="h-5 shrink-0 px-1.5 font-mono text-[10px] tabular-nums">
                          {incidentId}
                        </Badge>
                        <p className="truncate text-sm font-medium text-foreground">{login.userName}</p>
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 gap-1 px-1.5 text-[10px]"
                          style={{ borderColor: `${tone}55`, color: tone }}
                        >
                          <Icon className="size-2.5" />
                          {login.riskScore ?? "—"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[login.city, login.country].filter(Boolean).join(", ") || "Unknown location"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <MonitorSmartphone className="size-3 shrink-0" />
                        {login.deviceLabel}
                      </p>
                    </div>

                    <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {formatDistanceToNowStrict(login.occurredAt, { addSuffix: true })}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ol>
      </ScrollArea>
    </section>
  );
}
