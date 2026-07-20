import { prisma } from "@/lib/prisma";

export interface OtpChallengeView {
  id: string;
  status: "PENDING" | "VERIFIED" | "EXPIRED" | "FAILED";
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  transaction: {
    id: string;
    merchant: string;
    amount: number;
    beneficiary: string | null;
    date: Date;
  };
}

export async function getOtpChallengeView(
  userId: string,
  challengeId: string
): Promise<OtpChallengeView | null> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { id: challengeId, transaction: { account: { userId } } },
    include: { transaction: true },
  });

  if (!challenge) return null;

  return {
    id: challenge.id,
    status: challenge.status,
    expiresAt: challenge.expiresAt,
    attempts: challenge.attempts,
    maxAttempts: challenge.maxAttempts,
    transaction: {
      id: challenge.transaction.id,
      merchant: challenge.transaction.merchant,
      amount: Number(challenge.transaction.amount),
      beneficiary: challenge.transaction.beneficiary,
      date: challenge.transaction.date,
    },
  };
}
