import type { Metadata } from "next";
import { BellOff } from "lucide-react";

import { getSystemAlerts } from "@/services/admin/get-system-alerts";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { AdminAlertsList } from "@/features/admin/admin-alerts-list";

export const metadata: Metadata = { title: "Alerts" };

export default async function AdminAlertsPage() {
  const alerts = await getSystemAlerts();

  return (
    <PageContainer>
      <PageHeader
        title="Alerts"
        description="Every risk alert generated across the platform, most recent first."
      />
      <Card className="p-0">
        {alerts.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={BellOff} title="No alerts" description="Nothing has been flagged yet." />
          </div>
        ) : (
          <AdminAlertsList alerts={alerts} />
        )}
      </Card>
    </PageContainer>
  );
}
