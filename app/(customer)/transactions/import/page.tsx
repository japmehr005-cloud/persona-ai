import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs";
import { CsvImportWizard } from "@/features/transactions/csv-import-wizard";

export const metadata: Metadata = { title: "Import statements" };

export default async function ImportTransactionsPage() {
  const user = await requireUser();
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, mask: true },
  });

  return (
    <PageContainer className="max-w-3xl">
      <PageBreadcrumbs
        items={[{ label: "Transactions", href: "/transactions" }, { label: "Import" }]}
      />
      <PageHeader
        title="Import statements"
        description="Upload a CSV export from your bank to bring in your transaction history."
      />
      <CsvImportWizard accounts={accounts} />
    </PageContainer>
  );
}
