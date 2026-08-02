import type { Metadata } from "next";
import { format } from "date-fns";
import { ShieldAlert } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getFinEventsForUser } from "@/services/fin/fin-event-logger";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertSeverity } from "@prisma/client";

export const metadata: Metadata = { title: "Security events" };

const SEVERITY_VARIANT: Record<AlertSeverity, "success" | "warning" | "destructive"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "destructive",
};

export default async function SecurityEventsPage() {
  const user = await requireUser();
  const events = await getFinEventsForUser(user.id);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Security events"
        description="Everything the Fraud Intelligence Network has detected or acted on for your account."
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>
            Includes new devices, new locations, step-up verification, and any fraud reports you&apos;ve filed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No security events yet"
              description="Unusual sign-ins, device changes, and fraud reports will appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <ShieldAlert className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{event.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.deviceLabel ? `${event.deviceLabel} · ` : ""}
                        {format(event.createdAt, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={SEVERITY_VARIANT[event.severity]} className="flex-shrink-0">
                    {event.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
