"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOtpChallenge, type VerifyOtpFailureReason } from "@/services/otp-engine/otp-service";

const verifyOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/, "Enter the 6-digit code."),
  deviceFingerprintHash: z.string().optional(),
});

const OTP_VERIFY_ATTEMPT_LIMIT = 10;
const OTP_VERIFY_ATTEMPT_WINDOW_MS = 2 * 60 * 1000;

export interface VerifyOtpActionResult {
  ok: boolean;
  reason?: VerifyOtpFailureReason;
  attemptsRemaining?: number;
}

export async function verifyOtpAction(
  challengeId: string,
  code: string,
  deviceFingerprintHash?: string
): Promise<VerifyOtpActionResult> {
  const user = await requireUser();

  const rateLimit = checkRateLimit(
    `otp-verify:${user.id}`,
    OTP_VERIFY_ATTEMPT_LIMIT,
    OTP_VERIFY_ATTEMPT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return { ok: false, reason: "rate-limited" };
  }

  const parsed = verifyOtpSchema.safeParse({ challengeId, code, deviceFingerprintHash });
  if (!parsed.success) {
    return { ok: false, reason: "invalid-code" };
  }

  const result = await verifyOtpChallenge(
    user.id,
    parsed.data.challengeId,
    parsed.data.code,
    parsed.data.deviceFingerprintHash
  );

  revalidatePath("/alerts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  if (result.ok) return { ok: true };
  return { ok: false, reason: result.reason, attemptsRemaining: result.attemptsRemaining };
}
