"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  Fingerprint,
  Globe2,
  Loader2,
  MapPin,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { SecurityMapMarker } from "@/services/fin/geo-intelligence";
import { markDeviceTrustedAction } from "@/features/security/device-actions";
import {
  AUTH_METHOD_LABEL,
  RISK_COLOR_BADGE_CLASS,
  RISK_COLOR_LABEL,
  RISK_TIER_BADGE_CLASS,
  RISK_TIER_LABEL,
} from "@/lib/fin-labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReportDialog } from "@/features/fin/report-dialog";
import { useAccessibilityOptional } from "@/features/accessibility/accessibility-provider";

function buildBehaviorComparison(marker: SecurityMapMarker): string {
  if (marker.isImpossibleTravel) {
    return "Impossible travel detected — this sign-in could not physically follow your previous login in the time available. High risk; verification is required before trusting this session.";
  }
  if (marker.fraudReportCount > 0) {
    return "This sign-in deviates significantly from your usual pattern and is linked to a fraud report on your account.";
  }
  if (marker.riskColor === "amber") {
    const reasons: string[] = [];
    if (!marker.deviceTrusted) reasons.push("an unconfirmed device");
    if (!marker.sessionTrusted) reasons.push("a location we haven't confirmed as trusted yet");
    if (marker.riskTier === "HIGH" || marker.riskTier === "CRITICAL") reasons.push("a higher-than-usual risk score");
    if (reasons.length === 0) return "This sign-in required extra attention from the Risk Engine.";
    return `This sign-in used ${reasons.join(" and ")}, which is why it required extra attention.`;
  }
  return "This sign-in is consistent with your established device and location history.";
}

function DetailRow({
  icon: Icon,
  label,
  value,
  large,
}: {
  icon: typeof Fingerprint;
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3", large && "gap-4 py-1")}>
      <span
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-200",
          large ? "size-11" : "size-8"
        )}
      >
        <Icon className={large ? "size-5" : "size-4"} />
      </span>
      <div className="min-w-0">
        <p className={cn("text-slate-400", large ? "text-sm" : "text-xs")}>{label}</p>
        <p className={cn("truncate font-medium text-slate-100", large ? "text-base" : "text-sm")}>
          {value}
        </p>
      </div>
    </div>
  );
}

function SequenceBadge({ number, className }: { number: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/15 text-xs font-semibold tabular-nums text-sky-200",
        className
      )}
      aria-label={`Login sequence ${number}`}
    >
      {number}
    </span>
  );
}

function TrustDeviceAction({ deviceId, large }: { deviceId: string; large?: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      variant="outline"
      className={cn(
        "w-full border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-slate-50",
        large && "min-h-14 text-base"
      )}
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        try {
          await markDeviceTrustedAction(deviceId);
          toast.success("Device marked as trusted.");
          router.refresh();
        } catch {
          toast.error("Could not trust this device.");
        } finally {
          setIsPending(false);
        }
      }}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
      Trust this device
    </Button>
  );
}

function IntelBody({ marker, onClose }: { marker: SecurityMapMarker; onClose?: () => void }) {
  const a11y = useAccessibilityOptional();
  const large = Boolean(a11y?.largeText || a11y?.seniorMode);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Fixed header */}
      <div className={cn("shrink-0 border-b border-white/10 px-4 py-4", large && "px-5 py-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <SequenceBadge
              number={marker.sequenceNumber}
              className={large ? "size-10 text-sm" : undefined}
            />
            <div className="min-w-0">
              <p className={cn("truncate font-semibold text-slate-50", large ? "text-lg" : "text-base")}>
                {marker.deviceLabel}
              </p>
              <p className={cn("mt-0.5 text-slate-400", large ? "text-sm" : "text-xs")}>
                {format(marker.occurredAt, "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("shrink-0 text-slate-300", large ? "min-h-12 min-w-12" : "size-8")}
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {marker.isCurrent && (
            <Badge variant="outline" className={cn("border-sky-400/40 text-sky-300", large && "text-sm")}>
              Current session
            </Badge>
          )}
          <Badge
            className={cn("w-fit gap-1.5", RISK_COLOR_BADGE_CLASS[marker.riskColor], large && "text-sm")}
            variant="outline"
          >
            {marker.riskColor === "red" ? (
              <AlertTriangle className="size-3" />
            ) : marker.riskColor === "green" ? (
              <ShieldCheck className="size-3" />
            ) : (
              <ShieldQuestion className="size-3" />
            )}
            {RISK_COLOR_LABEL[marker.riskColor]}
          </Badge>
          {marker.isImpossibleTravel && (
            <Badge variant="destructive" className={cn("gap-1.5", large && "text-sm")}>
              <AlertTriangle className="size-3" />
              Impossible travel
            </Badge>
          )}
        </div>
      </div>

      {/* Scrollable content only */}
      <ScrollArea className="min-h-0 flex-1">
        <div className={cn("space-y-4 px-4 py-4", large && "space-y-5 px-5")}>
          <div className={cn("rounded-xl border border-white/10 bg-white/5 p-3", large && "p-4")}>
            <p className={cn("font-medium text-slate-400", large ? "text-sm" : "text-xs")}>AI explanation</p>
            <p className={cn("mt-1 leading-relaxed text-slate-100", large ? "text-base" : "text-sm")}>
              {buildBehaviorComparison(marker)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <DetailRow
              large={large}
              icon={MapPin}
              label="Location"
              value={[marker.city, marker.region, marker.country].filter(Boolean).join(", ") || "Unknown"}
            />
            <DetailRow large={large} icon={Globe2} label="Browser" value={marker.browser} />
            <DetailRow large={large} icon={Monitor} label="Operating system" value={marker.os} />
            <DetailRow
              large={large}
              icon={Fingerprint}
              label="Authentication"
              value={marker.authMethod ? AUTH_METHOD_LABEL[marker.authMethod] : "Not recorded"}
            />
            <DetailRow
              large={large}
              icon={Fingerprint}
              label={large ? "Phone identity code" : "Device fingerprint"}
              value={marker.fingerprintHash ? `${marker.fingerprintHash.slice(0, 18)}…` : "Unavailable"}
            />
          </div>

          <Separator className="bg-white/10" />

          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-slate-400">Risk score</p>
            <p className="text-2xl font-semibold tabular-nums text-slate-50">
              {marker.riskScore ?? "—"}
              <span className="text-sm font-normal text-slate-400"> / 100</span>
            </p>
            {marker.riskTier && (
              <Badge variant="outline" className={cn("mt-2", RISK_TIER_BADGE_CLASS[marker.riskTier])}>
                {RISK_TIER_LABEL[marker.riskTier]}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge
              variant="outline"
              className={
                marker.deviceTrusted
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : "border-amber-400/50 bg-amber-500/15 text-amber-200"
              }
            >
              {marker.deviceTrusted ? "Device trusted" : "Device not trusted"}
            </Badge>
            <Badge
              variant="outline"
              className={
                marker.sessionTrusted
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : "border-amber-400/50 bg-amber-500/15 text-amber-200"
              }
            >
              {marker.sessionTrusted ? "Location trusted" : "Location not trusted"}
            </Badge>
          </div>

          {marker.fraudReportCount > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-slate-100">
              {marker.fraudReportCount} related fraud report{marker.fraudReportCount > 1 ? "s" : ""}
              {marker.fraudReportTypes.length > 0
                ? `: ${marker.fraudReportTypes.join(", ").toLowerCase().replaceAll("_", " ")}`
                : ""}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pinned actions — always visible */}
      <div className={cn("shrink-0 space-y-2 border-t border-white/10 bg-[#0b1220]/98 px-4 py-3", large && "space-y-3 py-4")}>
        <ReportDialog
          type="NOT_ME"
          sessionId={marker.id}
          trigger={
            <Button
              variant="outline"
              className={cn(
                "w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
                large && "min-h-14 text-base"
              )}
            >
              <ShieldAlert className="size-4" />
              This wasn&apos;t me
            </Button>
          }
        />
        {marker.deviceId && !marker.deviceTrusted && (
          <TrustDeviceAction deviceId={marker.deviceId} large={large} />
        )}
        <ReportDialog
          type="SUSPICIOUS_LOGIN"
          sessionId={marker.id}
          trigger={
            <Button
              variant="secondary"
              className={cn("w-full bg-white/10 text-slate-100 hover:bg-white/15", large && "min-h-14 text-base")}
            >
              <AlertTriangle className="size-4" />
              Report suspicious login
            </Button>
          }
        />
      </div>
    </div>
  );
}

export interface LoginIntelPanelProps {
  marker: SecurityMapMarker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Desktop floating rail vs mobile bottom sheet. */
  variant: "rail" | "sheet";
}

/** Progressive-disclosure intel panel — keeps the map clean. */
export function LoginIntelPanel({ marker, open, onOpenChange, variant }: LoginIntelPanelProps) {
  if (variant === "sheet") {
    return (
      <Sheet open={open && marker !== null} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[75vh] flex-col overflow-hidden rounded-t-2xl border-white/10 bg-[#0b1220] p-0 text-slate-100"
        >
          {marker && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{marker.deviceLabel}</SheetTitle>
                <SheetDescription>Login intelligence details</SheetDescription>
              </SheetHeader>
              <IntelBody marker={marker} onClose={() => onOpenChange(false)} />
            </>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  if (!open || !marker) return null;

  return (
    <aside className="pointer-events-auto absolute bottom-4 right-4 top-4 z-20 hidden w-[340px] min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/95 shadow-2xl backdrop-blur md:block">
      <IntelBody marker={marker} onClose={() => onOpenChange(false)} />
    </aside>
  );
}

/** Keep old export name used by earlier imports during transition. */
export { LoginIntelPanel as LoginDetailSheet };
