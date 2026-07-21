"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Fingerprint, LogOut, Loader2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { logoutAllDevicesAction } from "@/features/settings/settings-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import type { DeviceView, SessionView } from "@/services/security/get-devices-and-sessions";

export function SessionManagementPanel({
  devices,
  sessions,
}: {
  devices: DeviceView[];
  sessions: SessionView[];
}) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutAll = async () => {
    setIsLoggingOut(true);
    const response = await logoutAllDevicesAction();
    setIsLoggingOut(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success("All devices have been signed out. You'll need to sign in again.");
    router.push("/login");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>Devices recognized on your account.</CardDescription>
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
                  <Badge variant={device.trusted ? "success" : "warning"}>
                    {device.trusted ? "Trusted" : "Not yet trusted"}
                  </Badge>
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
                    <p className="text-sm font-medium text-foreground">{session.deviceLabel ?? "Unknown device"}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress ?? "IP unavailable"} · Started {format(session.startedAt, "MMM d, h:mm a")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Active {format(session.lastActiveAt, "MMM d, h:mm a")}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out everywhere</CardTitle>
          <CardDescription>
            Immediately invalidate every session issued for your account, including this one.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isLoggingOut}>
                {isLoggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                Log out all devices
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Log out of every device?</AlertDialogTitle>
                <AlertDialogDescription>
                  This immediately invalidates every session issued for your account, including the one
                  you&apos;re using right now. You&apos;ll be redirected to sign in again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isLoggingOut}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleLogoutAll();
                  }}
                >
                  {isLoggingOut && <Loader2 className="animate-spin" />}
                  Log out all devices
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
