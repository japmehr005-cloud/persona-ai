import { prisma } from "@/lib/prisma";

export type SimulatedSignalType = "CALL" | "SMS" | "LOCATION";

const SIGNAL_LABELS: Record<SimulatedSignalType, string> = {
  CALL: "Inbound call",
  SMS: "Suspicious SMS",
  LOCATION: "Unusual location",
};

export async function injectContextSignal(userId: string, type: SimulatedSignalType) {
  return prisma.contextSignal.create({
    data: {
      userId,
      type,
      payload: { label: SIGNAL_LABELS[type], anomalous: true },
      simulated: true,
    },
  });
}

export async function clearContextSignals(userId: string) {
  await prisma.contextSignal.deleteMany({ where: { userId, transactionId: null } });
}
