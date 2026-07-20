"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Loader2, PhoneCall, MessageSquareWarning, MapPinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  clearContextSignalsAction,
  injectContextSignalAction,
} from "@/features/dev/context-signal-actions";
import type { ActiveSignalView } from "@/services/context-signals/get-active-signals";
import type { SimulatedSignalType } from "@/services/context-signals/inject-signal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SIGNAL_OPTIONS: { type: SimulatedSignalType; label: string; description: string; icon: typeof PhoneCall }[] = [
  {
    type: "CALL",
    label: "Trigger inbound call",
    description: "Simulates an active phone call during the next transaction — a common social-engineering pattern.",
    icon: PhoneCall,
  },
  {
    type: "SMS",
    label: "Trigger suspicious SMS",
    description: "Simulates an SMS matching known OTP-phishing patterns arriving during the next transaction.",
    icon: MessageSquareWarning,
  },
  {
    type: "LOCATION",
    label: "Trigger location anomaly",
    description: "Simulates the next transaction originating far from your usual locations.",
    icon: MapPinOff,
  },
];

export function ContextSignalForm({ activeSignals }: { activeSignals: ActiveSignalView[] }) {
  const router = useRouter();
  const [pendingType, setPendingType] = useState<SimulatedSignalType | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleTrigger = async (type: SimulatedSignalType) => {
    setPendingType(type);
    await injectContextSignalAction(type);
    setPendingType(null);
    toast.success("Signal injected — it will apply to your next simulated transaction.");
    router.refresh();
  };

  const handleClear = async () => {
    setIsClearing(true);
    await clearContextSignalsAction();
    setIsClearing(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {SIGNAL_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <div key={option.type} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTrigger(option.type)}
                disabled={pendingType !== null}
              >
                {pendingType === option.type && <Loader2 className="animate-spin" />}
                Trigger
              </Button>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Active signals</p>
          {activeSignals.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={isClearing}>
              {isClearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Clear all
            </Button>
          )}
        </div>

        {activeSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active signals. Trigger one above, then simulate a payment to see it factored into the
            risk score.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeSignals.map((signal) => (
              <li
                key={signal.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="warning">{signal.label}</Badge>
                  <span className="text-muted-foreground">
                    triggered {formatDistanceToNow(signal.receivedAt, { addSuffix: true })}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  expires {formatDistanceToNow(signal.expiresAt, { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
