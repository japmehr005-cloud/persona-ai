import { createHash } from "crypto";

export interface TransactionContext {
  userId: string;
  transactionId: string;
  amount: number;
  beneficiary: string | null;
  timestamp: Date;
}

/**
 * Binds an OTP challenge to the exact transaction it was issued for, so a
 * code cannot be replayed against a different amount, beneficiary, or
 * transaction — the "context-bound" property of CB-OTP.
 */
export function buildContextHash(context: TransactionContext): string {
  const raw = [
    context.userId,
    context.transactionId,
    context.amount.toFixed(2),
    context.beneficiary ?? "",
    context.timestamp.toISOString(),
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}
