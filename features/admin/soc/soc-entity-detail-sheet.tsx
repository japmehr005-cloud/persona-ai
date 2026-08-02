"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ExternalLink,
  Loader2,
  MapPin,
  MonitorSmartphone,
  Network,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import type { SocSnapshot } from "@/features/admin/fin-actions";
import { resolveFraudReportAction } from "@/features/admin/investigation-actions";
import { useSocSelectionStore } from "@/stores/soc-selection-store";
import {
  AUTH_METHOD_LABEL,
  FRAUD_REPORT_TYPE_LABEL,
  GOV_SOURCE_LABEL,
  RISK_COLOR_BADGE_CLASS,
  RISK_COLOR_LABEL,
  RISK_TIER_BADGE_CLASS,
  RISK_TIER_LABEL,
  SEVERITY_BADGE_CLASS,
} from "@/lib/fin-labels";
import { toIncidentId } from "@/lib/incident-id";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export interface SocEntityDetailSheetProps {
  snapshot: SocSnapshot;
  onOpenRelationships: () => void;
}

/** Shared SOC detail drawer — desktop right rail, mobile bottom sheet. */
export function SocEntityDetailSheet({ snapshot, onOpenRelationships }: SocEntityDetailSheetProps) {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const selection = useSocSelectionStore((state) => state.selection);
  const clear = useSocSelectionStore((state) => state.clear);
  const select = useSocSelectionStore((state) => state.select);
  const [confirming, setConfirming] = useState(false);

  const session = selection?.type === "session" ? snapshot.threatMap.markers.find((m) => m.id === selection.id) : null;
  const report = selection?.type === "fraudReport" ? snapshot.investigationQueue.find((r) => r.id === selection.id) : null;

  const relatedReports = useMemo(() => {
    if (!session) return [];
    return snapshot.investigationQueue.filter(
      (item) =>
        item.reporterName === session.userName ||
        (item.deviceLabel !== null && item.deviceLabel === session.deviceLabel)
    );
  }, [session, snapshot.investigationQueue]);

  const linkedNodes = useMemo(() => {
    if (!session) return [];
    const userNodeId = `user:${session.userId}`;
    const sessionNodeId = `session:${session.id}`;
    const deviceNodeId = session.deviceId ? `device:${session.deviceId}` : null;
    const seedIds = new Set([userNodeId, sessionNodeId, ...(deviceNodeId ? [deviceNodeId] : [])]);

    const connected = new Set<string>();
    for (const edge of snapshot.graph.edges) {
      if (seedIds.has(edge.source)) connected.add(edge.target);
      if (seedIds.has(edge.target)) connected.add(edge.source);
    }

    return snapshot.graph.nodes
      .filter((node) => connected.has(node.id) || seedIds.has(node.id))
      .filter((node) => node.type === "user" || node.type === "device" || node.type === "fraudReport")
      .slice(0, 8);
  }, [session, snapshot.graph]);

  const userTimeline = useMemo(() => {
    if (!session) return [];
    return snapshot.threatMap.markers
      .filter((marker) => marker.userId === session.userId)
      .slice(0, 5);
  }, [session, snapshot.threatMap.markers]);

  const governmentHits = useMemo(() => {
    if (!session) return snapshot.government.recentHits.slice(0, 3);
    const nameParts = session.userName.toLowerCase();
    const matched = snapshot.government.recentHits.filter((hit) =>
      nameParts.includes(hit.subjectValue.toLowerCase().trim())
    );
    return matched.length > 0 ? matched : snapshot.government.recentHits.slice(0, 2);
  }, [session, snapshot.government.recentHits]);

  const openReport =
    (report?.status === "OPEN" ? report : null) ??
    relatedReports.find((item) => item.status === "OPEN") ??
    null;

  async function handleConfirmFraud() {
    if (!openReport) {
      router.push("/admin/fin/recommendations");
      return;
    }
    setConfirming(true);
    const result = await resolveFraudReportAction(openReport.id, "CONFIRMED");
    setConfirming(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not confirm fraud.");
      return;
    }
    toast.success("Fraud confirmed. Clusters will refresh on the next live update.");
    router.refresh();
  }

  return (
    <Sheet open={selection !== null} onOpenChange={(open) => !open && clear()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden p-0",
          isDesktop ? "sm:max-w-md" : "h-[80vh] rounded-t-2xl"
        )}
      >
        {selection && (
          <>
            <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
              <SheetTitle className="pr-8">
                {session ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-sky-600 dark:text-sky-300">{toIncidentId(session.id)}</span>
                    <span>{session.userName}</span>
                  </span>
                ) : (
                  selection.label
                )}
              </SheetTitle>
              <SheetDescription className="capitalize">
                {session
                  ? `${session.deviceLabel} · ${[session.city, session.country].filter(Boolean).join(", ") || "Unknown"}`
                  : `${selection.type.replace(/([A-Z])/g, " $1")} intelligence`}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-4 px-6 py-4">
                {session && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("w-fit", RISK_COLOR_BADGE_CLASS[session.riskColor])} variant="outline">
                        {RISK_COLOR_LABEL[session.riskColor]}
                      </Badge>
                      {session.isImpossibleTravel && <Badge variant="destructive">Impossible travel</Badge>}
                      {session.riskTier && (
                        <Badge variant="outline" className={RISK_TIER_BADGE_CLASS[session.riskTier]}>
                          {RISK_TIER_LABEL[session.riskTier]}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <DetailField label="Customer" value={session.userName} />
                      <DetailField label="Risk score" value={`${session.riskScore ?? "—"} / 100`} />
                      <DetailField label="Device" value={session.deviceLabel} />
                      <DetailField
                        label="Location"
                        value={[session.city, session.country].filter(Boolean).join(", ") || "Unknown"}
                      />
                      <DetailField
                        label="Authentication"
                        value={session.authMethod ? AUTH_METHOD_LABEL[session.authMethod] : "Not recorded"}
                      />
                      <DetailField label="Behavior score" value={`${session.riskScore ?? "—"}`} />
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">FIN matches</p>
                      <p className="mt-1 text-sm text-foreground">
                        {session.fraudReportCount > 0
                          ? `${session.fraudReportCount} fraud report${session.fraudReportCount > 1 ? "s" : ""} linked to this device or session.`
                          : "No FIN fraud matches on this session yet."}
                      </p>
                      {relatedReports.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {relatedReports.slice(0, 3).map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-left text-xs hover:bg-accent"
                                onClick={() =>
                                  select({
                                    type: "fraudReport",
                                    id: item.id,
                                    label: FRAUD_REPORT_TYPE_LABEL[item.type],
                                  })
                                }
                              >
                                <span className="truncate font-medium">{FRAUD_REPORT_TYPE_LABEL[item.type]}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {item.status}
                                </Badge>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Government hits</p>
                      {governmentHits.length === 0 ? (
                        <p className="mt-1 text-sm text-muted-foreground">No FRI/MNRL hits in recent checks.</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {governmentHits.map((hit) => (
                            <li
                              key={hit.id}
                              className="rounded-lg border border-border/60 px-2.5 py-2 text-xs"
                            >
                              <p className="font-medium text-foreground">{hit.subjectValue}</p>
                              <p className="text-muted-foreground">
                                {GOV_SOURCE_LABEL[hit.source]} ·{" "}
                                {formatDistanceToNowStrict(hit.checkedAt, { addSuffix: true })}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Linked accounts</p>
                      {linkedNodes.length === 0 ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Open the relationship graph to explore linked entities.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {linkedNodes.map((node) => (
                            <li key={node.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-foreground">{node.label}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {node.type}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Recent timeline</p>
                      <ul className="mt-2 space-y-1.5">
                        {userTimeline.map((marker) => (
                          <li key={marker.id}>
                            <button
                              type="button"
                              onClick={() =>
                                select({
                                  type: "session",
                                  id: marker.id,
                                  label: `${marker.userName} · ${marker.deviceLabel}`,
                                })
                              }
                              className={cn(
                                "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent",
                                marker.id === session.id && "bg-accent"
                              )}
                            >
                              <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="font-medium text-foreground">
                                  {[marker.city, marker.country].filter(Boolean).join(", ") || "Unknown"}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                                  <MonitorSmartphone className="size-3" />
                                  {format(marker.occurredAt, "MMM d, h:mm a")}
                                </span>
                              </span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]", RISK_COLOR_BADGE_CLASS[marker.riskColor])}
                              >
                                {marker.riskScore ?? "—"}
                              </Badge>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {report && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{report.status}</Badge>
                      <Badge variant="outline" className={SEVERITY_BADGE_CLASS[report.severity]}>
                        {report.severity} severity
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{FRAUD_REPORT_TYPE_LABEL[report.type]}</p>
                    {report.description && <p className="text-sm text-muted-foreground">{report.description}</p>}
                    <p className="text-xs text-muted-foreground">
                      Filed by {report.reporterName} on {format(report.createdAt, "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </>
                )}

                {!session && !report && (
                  <p className="text-sm text-muted-foreground">
                    Selected from the relationship graph. Open relationships to expand connected entities.
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="shrink-0 space-y-2 border-t border-border px-6 py-3">
              <Button className="w-full" variant="default" onClick={onOpenRelationships}>
                <Network className="size-4" />
                View relationships
              </Button>
              {(session || report) && (
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={confirming}
                  onClick={() => void handleConfirmFraud()}
                >
                  {confirming ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
                  {openReport || report ? "Confirm fraud" : "Open investigation"}
                </Button>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/fin/recommendations">
                  AI recommendations <ExternalLink className="size-3.5" />
                </Link>
              </Button>
              {session?.deviceTrusted && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  Device previously marked trusted
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
