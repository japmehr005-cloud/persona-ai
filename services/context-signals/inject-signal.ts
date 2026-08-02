import { prisma } from "@/lib/prisma";

export type SimulatedSignalType = "CALL" | "SMS" | "LOCATION" | "DEVICE";

export type CallSignalSubtype = "unknown-caller" | "whatsapp-call";
export type SmsSignalSubtype = "scam-keywords";
export type LocationSignalSubtype = "impossible-travel" | "new-city" | "new-region";
export type DeviceSignalSubtype =
  | "rooted"
  | "emulator"
  | "fingerprint-mismatch"
  | "screen-share"
  | "remote-access"
  | "accessibility-abuse";

export type SignalSubtype = CallSignalSubtype | SmsSignalSubtype | LocationSignalSubtype | DeviceSignalSubtype;

export interface SignalOption {
  type: SimulatedSignalType;
  subtype?: SignalSubtype;
  label: string;
  description: string;
}

/**
 * Every signal a demo user can trigger from the Context Signal Simulator.
 * CALL/SMS/LOCATION keep their own `ContextSignalType`; the newer
 * device-integrity/screen-share/remote-access/accessibility signals all
 * reuse the existing `DEVICE` enum value with a `payload.subtype`
 * discriminator (see Phase 8 of the architecture plan) so no enum
 * migration is needed to add more of these later.
 */
export const SIGNAL_OPTIONS: SignalOption[] = [
  {
    type: "CALL",
    label: "Simulate Active Phone Call",
    description:
      "Feeds Social Engineering Protection only (ActiveCall = true). Does not change the Risk Engine score.",
  },
  {
    type: "CALL",
    subtype: "unknown-caller",
    label: "Simulate Active Phone Call (unknown caller)",
    description:
      "Social Engineering Protection signal — unknown-caller subtype. Does not change the Risk Engine score.",
  },
  {
    type: "CALL",
    subtype: "whatsapp-call",
    label: "Simulate Active Phone Call (WhatsApp)",
    description:
      "Social Engineering Protection signal — WhatsApp call subtype. Does not change the Risk Engine score.",
  },
  {
    type: "SMS",
    label: "Trigger suspicious SMS",
    description: "Simulates an SMS matching known OTP-phishing patterns arriving during the next transaction.",
  },
  {
    type: "SMS",
    subtype: "scam-keywords",
    label: "Trigger scam SMS keywords",
    description: "Simulates an SMS containing known scam keywords (\"urgent\", \"verify now\", \"account blocked\").",
  },
  {
    type: "LOCATION",
    subtype: "impossible-travel",
    label: "Trigger impossible travel",
    description: "Simulates a location that couldn't be reached from your last known location in the time elapsed.",
  },
  {
    type: "LOCATION",
    subtype: "new-city",
    label: "Trigger new city/state",
    description: "Simulates the transaction originating from a city or state you haven't transacted from before.",
  },
  {
    type: "LOCATION",
    subtype: "new-region",
    label: "Trigger new IP region",
    description: "Simulates the transaction's network location moving to a region you haven't used before.",
  },
  {
    type: "DEVICE",
    subtype: "rooted",
    label: "Trigger rooted device",
    description: "Simulates the transaction originating from a device reporting root/jailbreak access.",
  },
  {
    type: "DEVICE",
    subtype: "emulator",
    label: "Trigger emulator detected",
    description: "Simulates the transaction originating from an emulated device rather than physical hardware.",
  },
  {
    type: "DEVICE",
    subtype: "fingerprint-mismatch",
    label: "Trigger fingerprint mismatch",
    description: "Simulates this device's fingerprint changing unexpectedly mid-session.",
  },
  {
    type: "DEVICE",
    subtype: "screen-share",
    label: "Trigger screen sharing",
    description: "Simulates a screen-sharing session being active during the next transaction.",
  },
  {
    type: "DEVICE",
    subtype: "remote-access",
    label: "Trigger remote access software",
    description: "Simulates remote-control software (e.g. AnyDesk/TeamViewer) running during the next transaction.",
  },
  {
    type: "DEVICE",
    subtype: "accessibility-abuse",
    label: "Trigger accessibility-service abuse",
    description: "Simulates accessibility-service permissions being used in a pattern consistent with on-device fraud automation.",
  },
];

export function describeSignal(type: SimulatedSignalType, subtype?: SignalSubtype): string {
  const match = SIGNAL_OPTIONS.find((option) => option.type === type && option.subtype === subtype);
  return match?.label.replace(/^Trigger /, "") ?? type;
}

export async function injectContextSignal(
  userId: string,
  type: SimulatedSignalType,
  subtype?: SignalSubtype
) {
  return prisma.contextSignal.create({
    data: {
      userId,
      type,
      payload: { label: describeSignal(type, subtype), subtype: subtype ?? null, anomalous: true },
      simulated: true,
    },
  });
}

export async function clearContextSignals(userId: string) {
  await prisma.contextSignal.deleteMany({ where: { userId, transactionId: null } });
}
