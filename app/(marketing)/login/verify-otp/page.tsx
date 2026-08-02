import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Smartphone } from "lucide-react";

import { getLoginOtpChallengeView } from "@/services/auth/login-otp";
import { LoginOtpVerifyForm } from "@/features/auth/login-otp-verify-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Verify your identity" };

export default async function LoginVerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string; demoCode?: string }>;
}) {
  const { challengeId, demoCode } = await searchParams;
  if (!challengeId) redirect("/login");

  const challenge = await getLoginOtpChallengeView(challengeId);
  if (!challenge || challenge.status !== "PENDING") redirect("/login?error=otp-expired");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Smartphone className="size-5" />
        </span>
        <CardTitle className="mt-2">Enter your one-time code</CardTitle>
        <CardDescription>
          We sent a 6-digit code to your email, bound to this device and sign-in attempt. It expires in 60
          seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginOtpVerifyForm
          challengeId={challenge.id}
          expiresAt={challenge.expiresAt}
          attemptsRemaining={challenge.maxAttempts - challenge.attempts}
          demoCode={demoCode}
        />
      </CardContent>
    </Card>
  );
}
