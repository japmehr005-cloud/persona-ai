import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { getPendingTotpLoginChallenge } from "@/services/auth/login-challenge";
import { TwoFactorVerifyForm } from "@/features/auth/two-factor-verify-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Verify your identity" };

export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/login");

  const challenge = await getPendingTotpLoginChallenge(token);
  if (!challenge) redirect("/login?error=2fa-expired");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <CardTitle className="mt-2">Two-factor verification</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app to finish signing in as {challenge.userEmail}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TwoFactorVerifyForm token={token} />
      </CardContent>
    </Card>
  );
}
