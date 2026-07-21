import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { getVerificationSession } from "@/services/transactions/verification-session";
import { PageContainer } from "@/components/layout/page-container";
import { HighRiskVerificationPanel } from "@/features/transactions/high-risk-verification-panel";

export const metadata: Metadata = { title: "Verify transaction" };

export default async function VerificationSessionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const user = await requireUser();
  const { transactionId } = await params;

  const session = await getVerificationSession(user.id, transactionId);
  if (!session) notFound();

  return (
    <PageContainer className="max-w-2xl">
      <HighRiskVerificationPanel session={session} />
    </PageContainer>
  );
}
