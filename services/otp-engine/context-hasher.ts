import { createHash } from "crypto";

import type { OtpPurpose } from "@prisma/client";

export interface OtpContext {
  userId: string;
  purpose: OtpPurpose;
  transactionId: string | null;
  amount: number | null;
  beneficiary: string | null;
  /** Included so the OTP is bound to the device it was issued to, not just
   * the transaction — a code intercepted (e.g. via SIM swap) and replayed
   * from a different device fails this check even with the right digits. */
  deviceFingerprintHash: string | null;
  timestamp: Date;
}

/**
 * Binds an OTP challenge to the exact context it was issued for — the
 * transaction (amount/beneficiary), the device, and the moment in time —
 * so a code cannot be replayed against a different amount, beneficiary,
 * device, or transaction. This is the "context-bound" property of CB-OTP.
 * Login-purpose challenges have no transaction, so those fields are simply
 * absent from the hash for that purpose.
 */
export function buildContextHash(context: OtpContext): string {
  const raw = [
    context.userId,
    context.purpose,
    context.transactionId ?? "",
    context.amount !== null ? context.amount.toFixed(2) : "",
    context.beneficiary ?? "",
    context.deviceFingerprintHash ?? "",
    context.timestamp.toISOString(),
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}
