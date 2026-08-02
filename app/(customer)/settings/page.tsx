import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { getUserSettingsView } from "@/services/settings/get-user-settings";
import { getDevicesAndSessions } from "@/services/security/get-devices-and-sessions";
import { PageContainer } from "@/components/layout/page-container";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { TranslatedPageHeader } from "@/features/i18n/translated-page-header";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const [{ tab }, settings, devicesAndSessions] = await Promise.all([
    searchParams,
    getUserSettingsView(user.id),
    getDevicesAndSessions(user.id),
  ]);

  const showDeveloperTab =
    settings.isDemo || settings.demoModeBuildFlagEnabled || settings.riskEngineDemoMode;
  const defaultTab =
    tab === "accessibility" ||
    tab === "security" ||
    tab === "risk-engine" ||
    tab === "accounts" ||
    tab === "sessions" ||
    (tab === "developer" && showDeveloperTab)
      ? tab
      : "profile";

  return (
    <PageContainer className="max-w-4xl">
      <TranslatedPageHeader namespace="settings" />
      <SettingsTabs
        defaultTab={defaultTab}
        settings={settings}
        devicesAndSessions={devicesAndSessions}
        showDeveloperTab={showDeveloperTab}
      />
    </PageContainer>
  );
}
