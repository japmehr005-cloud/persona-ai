"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { createTotpLoginChallenge, getPendingTotpLoginChallenge } from "@/services/auth/login-challenge";

const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export interface LoginActionState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
  }

  const rateLimit = checkRateLimit(
    `login:${parsed.data.email.toLowerCase()}`,
    LOGIN_ATTEMPT_LIMIT,
    LOGIN_ATTEMPT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }

  // Accounts with 2FA enabled never complete sign-in here — password is
  // checked up front (so a wrong password never reveals 2FA is enrolled),
  // then control hands off to /login/verify-2fa for the TOTP step. Accounts
  // without 2FA fall through to the unchanged single-step signIn below.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { twoFactorCredential: { select: { enabled: true } } },
  });
  if (user) {
    const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (passwordValid && user.twoFactorCredential?.enabled) {
      const token = await createTotpLoginChallenge(user.id);
      redirect(`/login/verify-2fa?token=${token}`);
    }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }

  return {};
}

export interface VerifyTwoFactorActionState {
  error?: string;
}

const verifyTwoFactorSchema = z.object({
  token: z.string().min(1),
  code: z.string().min(6, "Enter the 6-digit code from your authenticator app.").max(8),
});

export async function verifyTwoFactorLoginAction(
  _prevState: VerifyTwoFactorActionState,
  formData: FormData
): Promise<VerifyTwoFactorActionState> {
  const parsed = verifyTwoFactorSchema.safeParse({
    token: formData.get("token"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid code." };
  }

  const challenge = await getPendingTotpLoginChallenge(parsed.data.token);
  if (!challenge) {
    return { error: "This sign-in session has expired. Please sign in again." };
  }

  const rateLimit = checkRateLimit(`2fa-login:${challenge.userId}`, 8, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  try {
    await signIn("credentials", {
      challengeToken: parsed.data.token,
      code: parsed.data.code,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid or expired code. Please try again." };
    }
    throw error;
  }

  return {};
}

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export interface RegisterActionState {
  error?: string;
}

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      accounts: {
        create: {
          name: "Primary Checking",
          mask: "0000",
          type: "CHECKING",
          balance: 0,
        },
      },
    },
  });

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }

  return {};
}

export async function demoLoginAction() {
  const demoUser = await prisma.user.findFirst({
    where: { isDemo: true, role: "CUSTOMER" },
    orderBy: { createdAt: "asc" },
  });

  if (!demoUser) {
    redirect("/login?error=demo-unavailable");
  }

  try {
    await signIn("credentials", {
      email: demoUser.email,
      password: "demo-password",
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=demo-unavailable");
    }
    throw error;
  }
}
