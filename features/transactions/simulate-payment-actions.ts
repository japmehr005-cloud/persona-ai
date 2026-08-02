"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { PAUSE_ON_CALL_MIN_AMOUNT, TRANSACTION_CATEGORIES } from "@/lib/constants";
import { callDetectionProvider, isWhatsAppCall } from "@/services/context-signals/call-detection";
import { recordFinEvent } from "@/services/fin/fin-event-logger";
import {
  simulateTransaction,
  type SimulateTransactionResult,
} from "@/services/transactions/simulate-transaction";

const SIMULATE_PAYMENT_LIMIT = 15;
const SIMULATE_PAYMENT_WINDOW_MS = 5 * 60 * 1000;

const simulatePaymentSchema = z.object({
  accountId: z.string().min(1),
  merchant: z.string().min(1).max(120),
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z.number().positive().max(1_000_000),
  beneficiary: z.string().max(120).optional(),
  channel: z.enum(["CARD", "TRANSFER", "ACH", "ATM", "ONLINE"]),
  fingerprintHash: z.string().optional(),
  /** Set once the customer has seen and dismissed the active-call warning
   * and explicitly chosen to continue — see `PausedForCallResult` below. */
  acknowledgeCallWarning: z.boolean().optional(),
});

export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;

export interface PausedForCallResult {
  ok: true;
  paused: true;
  reason: "active-call";
  isWhatsAppCall: boolean;
  merchant: string;
  amount: number;
}

export type SimulatePaymentActionResult =
  | { ok: true; result: SimulateTransactionResult }
  | PausedForCallResult
  | { ok: false; error: string };

export async function simulatePaymentAction(
  input: SimulatePaymentInput
): Promise<SimulatePaymentActionResult> {
  const user = await requireUser();

  const rateLimit = checkRateLimit(
    `simulate-payment:${user.id}`,
    SIMULATE_PAYMENT_LIMIT,
    SIMULATE_PAYMENT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many simulated payments recently. Please wait a few minutes and try again." };
  }

  const parsed = simulatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment details." };
  }

  // Context Intelligence: pause risk-eligible transactions attempted while
  // an active call signal is present, before the transaction is even
  // created — a real fraud call keeps the victim on the line while they
  // "confirm a transfer", so this UX interrupts exactly that moment rather
  // than silently scoring the transaction higher after the fact.
  if (!parsed.data.acknowledgeCallWarning && parsed.data.amount >= PAUSE_ON_CALL_MIN_AMOUNT) {
    const callSignal = await callDetectionProvider.getActiveCallSignal(user.id);
    if (callSignal.active) {
      await recordFinEvent({
        type: "TRANSACTION_PAUSED_CALL_ACTIVE",
        severity: "HIGH",
        userId: user.id,
        beneficiary: parsed.data.beneficiary || null,
        summary: `Transaction to ${parsed.data.merchant} paused — active call detected`,
        metadata: { amount: parsed.data.amount, callSubtype: callSignal.subtype },
      });

      return {
        ok: true,
        paused: true,
        reason: "active-call",
        isWhatsAppCall: isWhatsAppCall(callSignal),
        merchant: parsed.data.merchant,
        amount: parsed.data.amount,
      };
    }
  }

  try {
    const result = await simulateTransaction({
      userId: user.id,
      accountId: parsed.data.accountId,
      merchant: parsed.data.merchant,
      category: parsed.data.category,
      amount: -Math.abs(parsed.data.amount),
      beneficiary: parsed.data.beneficiary || null,
      channel: parsed.data.channel,
      fingerprintHash: parsed.data.fingerprintHash ?? null,
    });

    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/alerts");

    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed unexpectedly.";
    return { ok: false, error: message };
  }
}
