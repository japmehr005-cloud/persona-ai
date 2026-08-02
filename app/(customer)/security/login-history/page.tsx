import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getSecurityMapForUser } from "@/services/fin/geo-intelligence";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { LoginMapPanel } from "@/features/security/login-map-panel";
import { SecurityMapHeader } from "@/features/security/security-map-header";

export const metadata: Metadata = { title: "Security map" };

export default async function LoginHistoryPage() {
  const user = await requireUser();
  const securityMap = await getSecurityMapForUser(user.id);

  return (
    <PageContainer className="max-w-[1600px] space-y-4">
      <SecurityMapHeader />

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
