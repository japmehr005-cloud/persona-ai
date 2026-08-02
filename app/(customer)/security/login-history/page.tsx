import type { Metadata } from "next";
import { MapPin, ShieldAlert } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getSecurityMapForUser } from "@/services/fin/geo-intelligence";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportDialog } from "@/features/fin/report-dialog";
import { Button } from "@/components/ui/button";
import { LoginMapPanel } from "@/features/security/login-map-panel";

export const metadata: Metadata = { title: "Security map" };

export default async function LoginHistoryPage() {
  const user = await requireUser();
  const securityMap = await getSecurityMapForUser(user.id);

  return (
    <PageContainer className="max-w-[1600px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Security map</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sign-in intelligence across your trusted and flagged locations. Select a session to inspect risk, device, and travel path.
          </p>
        </div>
        <ReportDialog
          type="SUSPICIOUS_LOGIN"
          trigger={
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <ShieldAlert />
              Report suspicious login
            </Button>
          }
        />
      </div>

      {securityMap.markers.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No login activity yet"
          description="Your sign-ins will appear here on an interactive map as you use Persona AI."
        />
      ) : (
        <LoginMapPanel data={securityMap} />
      )}
    </PageContainer>
  );
}
