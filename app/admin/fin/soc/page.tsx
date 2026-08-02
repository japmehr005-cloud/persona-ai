import type { Metadata } from "next";

import { getSocSnapshotAction } from "@/features/admin/fin-actions";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SocCommandCenter } from "@/features/admin/soc-command-center";

export const metadata: Metadata = { title: "Security Operations Center" };

export default async function SecurityOperationsCenterPage() {
  const snapshot = await getSocSnapshotAction();

  return (
    <PageContainer className="max-w-[1600px]">
      <PageHeader
        title="Security Operations Center"
        description="Every customer login, transaction, and fraud report correlated live — the command center for the Fraud Intelligence Network."
      />
      <SocCommandCenter initialSnapshot={snapshot} />
    </PageContainer>
  );
}
