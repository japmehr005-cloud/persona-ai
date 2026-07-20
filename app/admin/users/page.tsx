import type { Metadata } from "next";

import { getUserDirectory } from "@/services/admin/get-user-directory";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "@/features/admin/users-table";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminUsersPage() {
  const users = await getUserDirectory();

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="Search and review customer risk posture across the platform."
      />
      <UsersTable users={users} />
    </PageContainer>
  );
}
