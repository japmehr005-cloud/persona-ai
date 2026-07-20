import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { getOtpChallengeView } from "@/services/otp-engine/get-challenge-view";
import { PageContainer } from "@/components/layout/page-container";
import { ContextBoundSummary } from "@/components/shared/context-bound-summary";
import { OtpVerificationForm } from "@/features/security/otp-verification-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Verify transaction" };

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string }>;
}) {
  const user = await requireUser();
  const { challengeId } = await searchParams;

  if (!challengeId) notFound();

  const challenge = await getOtpChallengeView(user.id, challengeId);
  if (!challenge) notFound();

  return (
    <PageContainer className="max-w-lg">
      <Card>
        <CardHeader className="items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <CardTitle className="mt-2">Additional verification required</CardTitle>
          <CardDescription>
            We sent a 6-digit code bound to this transaction. Enter it below to complete
            authorization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ContextBoundSummary
            merchant={challenge.transaction.merchant}
            amount={challenge.transaction.amount}
            beneficiary={challenge.transaction.beneficiary}
            date={challenge.transaction.date}
          />

          <OtpVerificationForm
            challengeId={challenge.id}
            expiresAt={challenge.expiresAt}
            attemptsRemaining={challenge.maxAttempts - challenge.attempts}
            transactionId={challenge.transaction.id}
            initialStatus={challenge.status}
          />
          {/* Once mounted, OtpVerificationForm owns all terminal-state
              rendering (approved, expired, denied, already-verified) so a
              background Router Cache refresh after verification can't
              unmount it and replace it with a stale server-rendered state. */}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
