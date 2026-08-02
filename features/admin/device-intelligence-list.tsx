"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Fingerprint, Languages, Monitor, Timer, Users } from "lucide-react";

import type { DeviceIntelligenceView } from "@/services/admin/get-device-intelligence";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function trustScoreTone(score: number): { badge: "success" | "warning" | "destructive"; bar: string } {
  if (score >= 70) return { badge: "success", bar: "bg-success" };
  if (score >= 40) return { badge: "warning", bar: "bg-warning" };
  return { badge: "destructive", bar: "bg-destructive" };
}

function formatComponentValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatComponentKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

/** Renders the Device Intelligence feed as a clickable list; selecting a
 * device opens the full multi-signal fingerprint snapshot (previously
 * captured on every login but never surfaced anywhere) alongside the
 * display-only trust score. */
export function DeviceIntelligenceList({ devices }: { devices: DeviceIntelligenceView[] }) {
  const [selected, setSelected] = useState<DeviceIntelligenceView | null>(null);

  const componentEntries = selected?.components ? Object.entries(selected.components) : [];
  const tone = selected ? trustScoreTone(selected.trustScore) : null;

  return (
    <>
      <ul className="divide-y divide-border">
        {devices.map((device) => {
          const rowTone = trustScoreTone(device.trustScore);
          return (
            <li key={device.id}>
              <button
                type="button"
                onClick={() => setSelected(device)}
                className="flex w-full flex-wrap items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-accent/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      device.trusted ? "bg-accent text-accent-foreground" : "bg-warning/10 text-warning"
                    )}
                  >
                    <Fingerprint className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{device.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.ownerName} · Last active {formatDistanceToNow(device.lastSeenAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={rowTone.badge}>Trust {device.trustScore}</Badge>
                  <Badge variant={device.trusted ? "success" : "warning"}>
                    {device.trusted ? "Trusted" : "Not yet trusted"}
                  </Badge>
                  {device.similarUserCount > 0 && (
                    <Badge variant="destructive">
                      <Users className="size-3" />
                      Shared with {device.similarUserCount} other{device.similarUserCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {device.fraudReportCount > 0 && (
                    <Badge variant="destructive">
                      {device.fraudReportCount} fraud report{device.fraudReportCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && tone && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.label}</SheetTitle>
                <SheetDescription>{selected.ownerName}</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 px-6 pb-6">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trust score</span>
                    <Badge variant={tone.badge}>{selected.trustScore} / 100</Badge>
                  </div>
                  <Progress value={selected.trustScore} className="h-2" indicatorClassName={tone.bar} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">First seen</p>
                    <p className="font-medium text-foreground">{format(selected.firstSeenAt, "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last active</p>
                    <p className="font-medium text-foreground">{formatDistanceToNow(selected.lastSeenAt, { addSuffix: true })}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Fingerprint hash</p>
                    <p className="truncate font-mono text-xs text-foreground">{selected.fingerprintHash}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Monitor className="size-3.5" /> Device signals
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Platform</p>
                      <p className="font-medium text-foreground">{selected.platform ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Screen</p>
                      <p className="font-medium text-foreground">{selected.screenResolution ?? "—"}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Timer className="size-3" /> Timezone
                      </p>
                      <p className="font-medium text-foreground">{selected.timezone ?? "—"}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Languages className="size-3" /> Language
                      </p>
                      <p className="font-medium text-foreground">{selected.language ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPU cores</p>
                      <p className="font-medium text-foreground">{selected.hardwareConcurrency ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Color depth</p>
                      <p className="font-medium text-foreground">{selected.colorDepth ? `${selected.colorDepth}-bit` : "—"}</p>
                    </div>
                    {selected.userAgent && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">User agent</p>
                        <p className="break-words text-xs text-foreground">{selected.userAgent}</p>
                      </div>
                    )}
                  </div>
                </div>

                {componentEntries.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Raw fingerprint snapshot
                      </p>
                      <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                        {componentEntries.map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-muted-foreground">{formatComponentKey(key)}</span>
                            <span className="break-all text-right font-mono text-foreground">
                              {formatComponentValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
