import { cookies } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialRequestOptionsJSON,
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";

import { prisma } from "@/lib/prisma";

const RP_NAME = "Persona AI";
const CHALLENGE_COOKIE_MAX_AGE_SECONDS = 120;
const REG_CHALLENGE_COOKIE = "webauthn_reg_challenge";
const AUTH_CHALLENGE_COOKIE = "webauthn_auth_challenge";

/**
 * Derives the WebAuthn Relying Party ID/origin from `NEXTAUTH_URL`, with
 * explicit `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` overrides for deployments
 * behind a different public hostname. `localhost` is a spec-allowed
 * exception to WebAuthn's HTTPS requirement, so local dev/demo works
 * without extra TLS setup.
 */
function getRpConfig(): { rpID: string; origin: string } {
  if (process.env.WEBAUTHN_RP_ID && process.env.WEBAUTHN_ORIGIN) {
    return { rpID: process.env.WEBAUTHN_RP_ID, origin: process.env.WEBAUTHN_ORIGIN };
  }

  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = new URL(base);
  return { rpID: url.hostname, origin: url.origin };
}

function bufferToBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString("base64url");
}

function base64UrlToBuffer(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export async function buildRegistrationOptions(
  userId: string,
  userEmail: string,
  displayName: string
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID } = getRpConfig();
  const existingCredentials = await prisma.webAuthnCredential.findMany({ where: { userId } });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: userId,
    userName: userEmail,
    userDisplayName: displayName,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((credential) => ({
      id: base64UrlToBuffer(credential.credentialId),
      type: "public-key" as const,
      transports: (credential.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(REG_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHALLENGE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  return options;
}

export type FinishRegistrationResult =
  | { ok: true }
  | { ok: false; error: "NO_CHALLENGE" | "VERIFICATION_FAILED" };

export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceLabel: string
): Promise<FinishRegistrationResult> {
  const { rpID, origin } = getRpConfig();
  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(REG_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) return { ok: false, error: "NO_CHALLENGE" };
  cookieStore.delete(REG_CHALLENGE_COOKIE);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: "VERIFICATION_FAILED" };
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: bufferToBase64Url(credentialID),
      publicKey: bufferToBase64Url(credentialPublicKey),
      counter,
      deviceLabel,
      transports: response.response.transports ?? undefined,
    },
  });

  return { ok: true };
}

export async function buildAuthenticationOptions(userId: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = getRpConfig();
  const credentials = await prisma.webAuthnCredential.findMany({ where: { userId } });

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: credentials.map((credential) => ({
      id: base64UrlToBuffer(credential.credentialId),
      type: "public-key" as const,
      transports: (credential.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    })),
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CHALLENGE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  return options;
}

export type FinishAuthenticationResult =
  | { ok: true }
  | { ok: false; error: "NO_CHALLENGE" | "UNKNOWN_CREDENTIAL" | "VERIFICATION_FAILED" };

/**
 * Verifies a WebAuthn assertion produced for a specific, already-registered
 * user — used as the "Verify Identity" step-up gate for HIGH/CRITICAL
 * transactions (an additional factor before CB-OTP is issued), not as a
 * standalone login mechanism.
 */
export async function finishAuthentication(
  userId: string,
  response: AuthenticationResponseJSON
): Promise<FinishAuthenticationResult> {
  const { rpID, origin } = getRpConfig();
  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get(AUTH_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) return { ok: false, error: "NO_CHALLENGE" };
  cookieStore.delete(AUTH_CHALLENGE_COOKIE);

  const credential = await prisma.webAuthnCredential.findFirst({
    where: { userId, credentialId: response.id },
  });
  if (!credential) return { ok: false, error: "UNKNOWN_CREDENTIAL" };

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: base64UrlToBuffer(credential.credentialId),
      credentialPublicKey: base64UrlToBuffer(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    },
  });

  if (!verification.verified) return { ok: false, error: "VERIFICATION_FAILED" };

  await prisma.webAuthnCredential.update({
    where: { id: credential.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });

  return { ok: true };
}

export interface WebAuthnCredentialView {
  id: string;
  deviceLabel: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export async function listWebAuthnCredentials(userId: string): Promise<WebAuthnCredentialView[]> {
  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return credentials.map((credential) => ({
    id: credential.id,
    deviceLabel: credential.deviceLabel,
    createdAt: credential.createdAt,
    lastUsedAt: credential.lastUsedAt,
  }));
}

export async function removeWebAuthnCredential(userId: string, credentialId: string): Promise<boolean> {
  const result = await prisma.webAuthnCredential.deleteMany({ where: { id: credentialId, userId } });
  return result.count > 0;
}
