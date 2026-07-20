import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RadioTower } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getActiveContextSignals } from "@/services/context-signals/get-active-signals";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ContextSignalForm } from "@/features/dev/context-signal-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Context Signal Simulator" };

export default async function ContextSimulatorPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED !== "true") notFound();

  const user = await requireUser();
  const activeSignals = await getActiveContextSignals(user.id);

  return (
    <PageContainer>
      <PageHeader
        title="Context Signal Simulator"
        description="Inject mock inbound call, SMS, or location events into the risk pipeline to see how the Adaptive Risk Engine reacts."
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        <RadioTower className="size-4 shrink-0" />
        Simulated environment — signals triggered here are for demonstration only and have no
        connection to a real phone, carrier, or GPS. In production, this data would come from a
        mobile companion SDK and carrier webhook integration.
      </div>

      <Card>
        <CardContent className="pt-6">
          <ContextSignalForm activeSignals={activeSignals} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
