import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isDemoModeActiveForUser } from "@/services/settings/get-user-settings";
import { AppShell } from "@/components/layout/app-shell";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationPopover } from "@/components/layout/notification-popover";
import { UserMenu } from "@/components/layout/user-menu";
import { DemoBanner } from "@/components/layout/demo-banner";
import { DeviceFingerprintProvider } from "@/features/security/device-fingerprint-provider";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [dbUser, openAlerts, demoModeActive] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.alert.findMany({
      where: { userId: user.id, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    isDemoModeActiveForUser(user.id),
  ]);

  return (
    <AppShell
      variant="customer"
      // Either the build-wide demo flag or the user's own Settings → Risk
      // Engine → Demo Mode toggle unlocks the simulator nav entry.
      includeDevNav={demoModeActive}
      brandHref="/dashboard"
      brandLabel="Persona AI"
      header={
        <div className="flex flex-1 items-center gap-4">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <NotificationPopover
              alerts={openAlerts.map((alert) => ({
                id: alert.id,
                title: alert.title,
                severity: alert.severity,
                createdAt: alert.createdAt,
              }))}
            />
            <UserMenu
              name={dbUser ? `${dbUser.firstName} ${dbUser.lastName}` : "Account"}
              email={dbUser?.email ?? ""}
              role={user.role}
            />
          </div>
        </div>
      }
    >
      <DeviceFingerprintProvider />
      {user.isDemo && <DemoBanner />}
      {children}
    </AppShell>
  );
}
