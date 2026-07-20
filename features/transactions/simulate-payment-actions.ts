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
});

export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;

export async function simulatePaymentAction(
  input: SimulatePaymentInput
): Promise<{ ok: true; result: SimulateTransactionResult } | { ok: false; error: string }> {
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
