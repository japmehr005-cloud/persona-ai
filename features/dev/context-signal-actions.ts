"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  clearContextSignals,
  injectContextSignal,
  type SignalSubtype,
  type SimulatedSignalType,
} from "@/services/context-signals/inject-signal";

export async function injectContextSignalAction(type: SimulatedSignalType, subtype?: SignalSubtype) {
  const user = await requireUser();
  await injectContextSignal(user.id, type, subtype);
  revalidatePath("/dev/context-simulator");
}

export async function clearContextSignalsAction() {
  const user = await requireUser();
  await clearContextSignals(user.id);
  revalidatePath("/dev/context-simulator");
}
