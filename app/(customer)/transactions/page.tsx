import Link from "next/link";
import type { Metadata } from "next";
import { Upload, Receipt } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getUserTransactions } from "@/services/transactions/get-user-transactions";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionsTable } from "@/features/transactions/transactions-table";
import { Button } from "@/components/ui/button";
import { TranslatedPageHeader } from "@/features/i18n/translated-page-header";
import { TransactionsImportButton } from "@/features/transactions/transactions-import-button";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await requireUser();
  await searchParams;
  const transactions = await getUserTransactions(user.id);

  return (
    <PageContainer>
      <TranslatedPageHeader
        namespace="transactions"
        actions={<TransactionsImportButton />}
      />

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Import a bank statement to see your activity here."
          action={
            <Button asChild size="sm">
              <Link href="/transactions/import">
                <Upload />
                Import statements
              </Link>
            </Button>
          }
        />
      ) : (
        <TransactionsTable transactions={transactions} />
      )}
    </PageContainer>
  );
}
