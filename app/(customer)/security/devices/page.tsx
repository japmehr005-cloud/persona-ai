import type { Metadata } from "next";
import { format } from "date-fns";
import { Fingerprint, MonitorSmartphone } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getDevicesAndSessions } from "@/services/security/get-devices-and-sessions";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RevokeDeviceDialog } from "@/features/security/revoke-device-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Devices & sessions" };

export default async function DevicesPage() {
  const user = await requireUser();
  const { devices, sessions } = await getDevicesAndSessions(user.id);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Devices & sessions"
        description="Devices and sessions we've recognized while you use Persona AI."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>
            New devices start untrusted until you&apos;ve used them a few times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <EmptyState
              icon={Fingerprint}
              title="No devices recognized yet"
              description="Devices are registered automatically as you use Persona AI."
            />
          ) : (
            <ul className="divide-y divide-border">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Fingerprint className="size-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{device.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Last active {format(device.lastSeenAt, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={device.trusted ? "success" : "warning"}>
                      {device.trusted ? "Trusted" : "Not yet trusted"}
                    </Badge>
                    <RevokeDeviceDialog deviceId={device.id} label={device.label} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>The last 10 sessions across all your devices.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No sessions recorded yet"
              description="Session history will appear here as you use Persona AI."
            />
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {session.deviceLabel ?? "Unknown device"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress ?? "IP unavailable"} · Started{" "}
                      {format(session.startedAt, "MMM d, h:mm a")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active {format(session.lastActiveAt, "MMM d, h:mm a")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
