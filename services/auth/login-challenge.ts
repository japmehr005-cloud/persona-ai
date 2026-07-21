import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const TOTP_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Creates the short-lived bridge row between step 1 (password verified) and
 * step 2 (TOTP code) of a multi-factor login. The token is an unguessable
 * random string surfaced to the browser only via the `/login/verify-2fa`
 * URL — it identifies *which* pending login this is, it does not itself
 * grant access (the TOTP code is still independently re-verified inside
 * the Credentials provider's `authorize()` before any session is minted).
 */
export async function createTotpLoginChallenge(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.pendingAuthChallenge.create({
    data: {
      userId,
      token,
      kind: "TOTP_LOGIN",
      expiresAt: new Date(Date.now() + TOTP_CHALLENGE_TTL_MS),
    },
  });
  return token;
}

export interface LoginChallengeView {
  userId: string;
  userEmail: string;
}

export async function getPendingTotpLoginChallenge(token: string): Promise<LoginChallengeView | null> {
  const challenge = await prisma.pendingAuthChallenge.findUnique({
    where: { token },
    include: { user: { select: { email: true } } },
  });

  if (!challenge || challenge.kind !== "TOTP_LOGIN" || challenge.consumed || challenge.expiresAt < new Date()) {
    return null;
  }

  return { userId: challenge.userId, userEmail: challenge.user.email };
}
