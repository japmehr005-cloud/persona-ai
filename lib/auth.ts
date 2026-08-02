import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { OTP } from "otplib";
import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getPendingWebAuthnLoginChallenge } from "@/services/auth/login-challenge";
import { finishAuthentication } from "@/services/auth/webauthn";
import { verifyLoginOtpChallenge } from "@/services/auth/login-otp";

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

const webauthnLoginCredentialsSchema = z.object({
  webauthnChallengeToken: z.string().min(1),
  webauthnAssertion: z.string().min(1),
});

const otpLoginCredentialsSchema = z.object({
  otpChallengeId: z.string().min(1),
  otpCode: z.string().min(1),
  otpDeviceFingerprintHash: z.string().optional(),
});

type AppSessionAuthMethod = "PASSWORD_ONLY" | "PASSWORD_OTP" | "PASSWORD_BIOMETRIC" | "AUTHENTICATOR" | "TOTP_2FA";

function toAuthUser(
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: "CUSTOMER" | "ANALYST" | "ADMIN";
    isDemo: boolean;
    sessionVersion: number;
  },
  authMethod: AppSessionAuthMethod
) {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role: user.role,
    isDemo: user.isDemo,
    sessionVersion: user.sessionVersion,
    authMethod,
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
        webauthnChallengeToken: { label: "WebAuthn challenge token" },
        webauthnAssertion: { label: "WebAuthn assertion" },
        otpChallengeId: { label: "Login OTP challenge id" },
        otpCode: { label: "Login OTP code" },
        otpDeviceFingerprintHash: { label: "Device fingerprint" },
      },
      async authorize(rawCredentials) {
        // Adaptive Authentication Option 2 (Password + Biometric) — step 2
        // exchanges a short-lived WebAuthn login challenge token + the
        // browser's signed assertion for a session. Re-verified here, not
        // trusted from the client, for the same reason as the TOTP branch
        // below: this callback is reachable directly via the public
        // `/api/auth/callback/credentials` route.
        if (typeof rawCredentials?.webauthnChallengeToken === "string") {
          const parsed = webauthnLoginCredentialsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;

          const challenge = await getPendingWebAuthnLoginChallenge(parsed.data.webauthnChallengeToken);
          if (!challenge) return null;

          let assertion: AuthenticationResponseJSON;
          try {
            assertion = JSON.parse(parsed.data.webauthnAssertion) as AuthenticationResponseJSON;
          } catch {
            return null;
          }

          const verification = await finishAuthentication(challenge.userId, assertion);
          if (!verification.ok) return null;

          await prisma.pendingAuthChallenge.updateMany({
            where: { token: parsed.data.webauthnChallengeToken, consumed: false },
            data: { consumed: true },
          });

          const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
          if (!user) return null;

          return toAuthUser(user, "PASSWORD_BIOMETRIC");
        }

        // Adaptive Authentication Option 1 (Password + OTP) — step 2
        // exchanges a login-purpose Context-Bound OTP challenge + code for
        // a session, reusing the same CB-OTP engine (and its device-binding
        // + context re-verification) as the transaction step-up flow.
        if (typeof rawCredentials?.otpChallengeId === "string") {
          const parsed = otpLoginCredentialsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;

          const result = await verifyLoginOtpChallenge(
            parsed.data.otpChallengeId,
            parsed.data.otpCode,
            parsed.data.otpDeviceFingerprintHash
          );
          if (!result.ok) return null;

          const user = await prisma.user.findUnique({ where: { id: result.userId } });
          if (!user) return null;

          return toAuthUser(user, "PASSWORD_OTP");
        }

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

          // "AUTHENTICATOR" and legacy 2FA share the same TOTP verification
          // path — distinguished only by whether the customer has explicitly
          // selected it as their Adaptive Authentication preference.
          const settings = await prisma.userSettings.findUnique({
            where: { userId: challenge.userId },
            select: { preferredAuthMethod: true },
          });
          const authMethod: AppSessionAuthMethod =
            settings?.preferredAuthMethod === "AUTHENTICATOR" ? "AUTHENTICATOR" : "TOTP_2FA";

          return toAuthUser(user, authMethod);
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

        return toAuthUser(user, "PASSWORD_ONLY");
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
        token.authMethod = (user as { authMethod: AppSessionAuthMethod }).authMethod;
        return token;
      }

      // Re-validated on every request (not just at sign-in) so "Logout all
      // devices" (Settings → Session Management) takes effect immediately —
      // returning null here signs this specific token out without waiting
      // for its 8h maxAge to expire naturally. Role is also refreshed from
      // the DB so a privilege change (or a JWT minted before role was
      // persisted correctly) never leaves an analyst locked out of /admin.
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { sessionVersion: true, role: true, isDemo: true },
      });
      if (!dbUser || dbUser.sessionVersion !== token.sessionVersion) {
        return null;
      }
      token.role = dbUser.role;
      token.isDemo = dbUser.isDemo;
      return token;
    },
  },
});
