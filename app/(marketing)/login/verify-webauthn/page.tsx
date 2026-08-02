import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Fingerprint } from "lucide-react";

import { getPendingWebAuthnLoginChallenge } from "@/services/auth/login-challenge";
import { WebAuthnLoginForm } from "@/features/auth/webauthn-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Verify your identity" };

export default async function LoginVerifyWebAuthnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/login");

  const challenge = await getPendingWebAuthnLoginChallenge(token);
  if (!challenge) redirect("/login?error=2fa-expired");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Fingerprint className="size-5" />
        </span>
        <CardTitle className="mt-2">Confirm it&apos;s you</CardTitle>
        <CardDescription>
          Use your device&apos;s fingerprint, face recognition, or security key to finish signing in as{" "}
          {challenge.userEmail}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WebAuthnLoginForm token={token} />
      </CardContent>
    </Card>
  );
}
