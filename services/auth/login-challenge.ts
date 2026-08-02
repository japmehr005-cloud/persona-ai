import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import type { PendingAuthChallengeKind } from "@prisma/client";

const LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * Creates the short-lived bridge row between step 1 (password verified) and
 * step 2 (TOTP code or WebAuthn assertion) of a multi-factor login. The
 * token is an unguessable random string surfaced to the browser only via
 * the corresponding `/login/verify-*` URL — it identifies *which* pending
 * login this is, it does not itself grant access (the second factor is
 * still independently re-verified inside the Credentials provider's
 * `authorize()` before any session is minted).
 */
async function createLoginChallenge(userId: string, kind: PendingAuthChallengeKind): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.pendingAuthChallenge.create({
    data: { userId, token, kind, expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS) },
  });
  return token;
}

export interface LoginChallengeView {
  userId: string;
  userEmail: string;
}

async function getPendingLoginChallenge(
  token: string,
  kind: PendingAuthChallengeKind
): Promise<LoginChallengeView | null> {
  const challenge = await prisma.pendingAuthChallenge.findUnique({
    where: { token },
    include: { user: { select: { email: true } } },
  });

  if (!challenge || challenge.kind !== kind || challenge.consumed || challenge.expiresAt < new Date()) {
    return null;
  }

  return { userId: challenge.userId, userEmail: challenge.user.email };
}

export async function createTotpLoginChallenge(userId: string): Promise<string> {
  return createLoginChallenge(userId, "TOTP_LOGIN");
}

export async function getPendingTotpLoginChallenge(token: string): Promise<LoginChallengeView | null> {
  return getPendingLoginChallenge(token, "TOTP_LOGIN");
}

/** Adaptive Authentication Option 2 (Password + Biometric) — completes the
 * previously-declared-but-unused `WEBAUTHN_LOGIN` challenge kind. */
export async function createWebAuthnLoginChallenge(userId: string): Promise<string> {
  return createLoginChallenge(userId, "WEBAUTHN_LOGIN");
}

export async function getPendingWebAuthnLoginChallenge(token: string): Promise<LoginChallengeView | null> {
  return getPendingLoginChallenge(token, "WEBAUTHN_LOGIN");
}
