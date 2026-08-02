import type { Metadata } from "next";
import { BellOff } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getUserAlerts } from "@/services/alerts/get-user-alerts";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { AlertRow } from "@/features/alerts/alert-row";
import { TranslatedPageHeader } from "@/features/i18n/translated-page-header";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const user = await requireUser();
  const alerts = await getUserAlerts(user.id);

  return (
    <PageContainer>
      <TranslatedPageHeader namespace="alerts" />

      {alerts.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No alerts yet"
          description="We'll notify you here if a transaction looks out of character."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y divide-border p-0">
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
