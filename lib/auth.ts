import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { OTP } from "otplib";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

const totp = new OTP({ strategy: "totp" });
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

const passwordCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const totpChallengeCredentialsSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(1),
});

function toAuthUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "CUSTOMER" | "ANALYST" | "ADMIN";
  isDemo: boolean;
  sessionVersion: number;
}) {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role: user.role,
    isDemo: user.isDemo,
    sessionVersion: user.sessionVersion,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password" },
        challengeToken: { label: "Challenge token" },
        code: { label: "Authenticator code" },
      },
      async authorize(rawCredentials) {
        // Step 2 of a 2FA login: exchanges a short-lived challenge token +
        // live TOTP code for a session. The code is independently
        // re-verified here (not trusted from the `/login/verify-2fa` form's
        // own pre-check) because this `authorize()` callback is reachable
        // directly via the public `/api/auth/callback/credentials` route,
        // so it must never trust caller-supplied "already verified" state.
        if (typeof rawCredentials?.challengeToken === "string") {
          const parsed = totpChallengeCredentialsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;

          const challenge = await prisma.pendingAuthChallenge.findUnique({
            where: { token: parsed.data.challengeToken },
          });
          if (
            !challenge ||
            challenge.kind !== "TOTP_LOGIN" ||
            challenge.consumed ||
            challenge.expiresAt < new Date()
          ) {
            return null;
          }

          const credential = await prisma.twoFactorCredential.findUnique({
            where: { userId: challenge.userId },
          });
          if (!credential?.enabled) return null;

          const codeResult = await totp.verify({
            secret: credential.secret,
            token: parsed.data.code,
            epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
          });
          if (!codeResult.valid) return null;

          // Single-use: mark consumed before returning so this token can
          // never mint a second session, even if the code was correct.
          await prisma.pendingAuthChallenge.update({
            where: { id: challenge.id },
            data: { consumed: true },
          });

          const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
          if (!user) return null;

          return toAuthUser(user);
        }

        // Step 1 (or the only step, for accounts without 2FA enabled).
        const parsed = passwordCredentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { twoFactorCredential: { select: { enabled: true } } },
        });
        if (!user) return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        // Accounts with 2FA enabled must complete the challengeToken branch
        // above instead — password alone is never sufficient once enrolled.
        if (user.twoFactorCredential?.enabled) return null;

        return toAuthUser(user);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as "CUSTOMER" | "ANALYST" | "ADMIN";
        token.isDemo = user.isDemo as boolean;
        token.sessionVersion = (user as { sessionVersion: number }).sessionVersion;
        return token;
      }

      // Re-validated on every request (not just at sign-in) so "Logout all
      // devices" (Settings → Session Management) takes effect immediately —
      // returning null here signs this specific token out without waiting
      // for its 8h maxAge to expire naturally. This DB read is intentionally
      // only in this Node-only override, never in the Edge-safe authConfig
      // shared with middleware.
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { sessionVersion: true },
      });
      if (!dbUser || dbUser.sessionVersion !== token.sessionVersion) {
        return null;
      }
      return token;
    },
  },
});
