"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { TRANSACTION_CATEGORIES } from "@/lib/constants";
import {
  simulateTransaction,
  type SimulateTransactionResult,
} from "@/services/transactions/simulate-transaction";
import {
  blockPausedTransaction,
  continueAfterSocialEngineeringPause,
} from "@/services/transactions/transaction-orchestrator";

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
  /**
   * When true, Social Engineering Protection will not pause — used after the
   * customer explicitly chooses Continue Anyway on a fresh attempt.
   * Prefer `continuePausedPaymentAction` for already-paused transactions.
   */
  acknowledgeSocialEngineering: z.boolean().optional(),
});

export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;

export type SimulatePaymentActionResult =
  | { ok: true; result: SimulateTransactionResult }
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
    return {
      ok: false,
      error: "Too many simulated payments recently. Please wait a few minutes and try again.",
    };
  }

  const parsed = simulatePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment details." };
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
      acknowledgeSocialEngineering: parsed.data.acknowledgeSocialEngineering,
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

/** Continue Anyway after Social Engineering Protection paused a transaction. */
export async function continuePausedPaymentAction(
  transactionId: string
): Promise<SimulatePaymentActionResult> {
  const user = await requireUser();

  try {
    const result = await continueAfterSocialEngineeringPause(user.id, transactionId);
    if (!result) {
      return { ok: false, error: "Paused transaction not found or already resolved." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/alerts");

    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not continue transaction.";
    return { ok: false, error: message };
  }
}

/** Cancel Transaction from the SE pause UI — orchestrator BLOCKED → DENIED. */
export async function cancelPausedPaymentAction(
  transactionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();

  const response = await blockPausedTransaction(user.id, transactionId);
  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/alerts");

  return { ok: true };
}
