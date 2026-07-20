import type { Metadata } from "next";

import { getFlaggedQueue } from "@/services/admin/get-flagged-queue";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { FlaggedTransactionsTable } from "@/features/admin/flagged-transactions-table";

export const metadata: Metadata = { title: "Flagged transactions" };

export default async function FlaggedTransactionsPage() {
  const transactions = await getFlaggedQueue();

  return (
    <PageContainer>
      <PageHeader
        title="Flagged transactions"
        description="Medium- and high-risk transactions across all customers. Select a row for the full signal dump."
      />
      <FlaggedTransactionsTable transactions={transactions} />
    </PageContainer>
  );
}
