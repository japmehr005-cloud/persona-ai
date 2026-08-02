"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/features/settings/profile-form";
import { SecurityForm } from "@/features/settings/security-form";
import { RiskEngineForm } from "@/features/settings/risk-engine-form";
import { ConnectedAccountsPanel } from "@/features/settings/connected-accounts-panel";
import { SessionManagementPanel } from "@/features/settings/session-management-panel";
import { DeveloperSettingsPanel } from "@/features/settings/developer-settings-panel";
import { AccessibilityForm } from "@/features/settings/accessibility-form";
import type { UserSettingsView } from "@/services/settings/get-user-settings";
import type { DeviceView, SessionView } from "@/services/security/get-devices-and-sessions";

export function SettingsTabs({
  defaultTab,
  settings,
  devicesAndSessions,
  showDeveloperTab,
}: {
  defaultTab: string;
  settings: UserSettingsView;
  devicesAndSessions: { devices: DeviceView[]; sessions: SessionView[] };
  showDeveloperTab: boolean;
}) {
  const t = useTranslations("settings");

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
        <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
        <TabsTrigger value="security">{t("tabs.security")}</TabsTrigger>
        <TabsTrigger value="accessibility">{t("tabs.accessibility")}</TabsTrigger>
        <TabsTrigger value="risk-engine">{t("tabs.riskEngine")}</TabsTrigger>
        <TabsTrigger value="accounts">{t("tabs.accounts")}</TabsTrigger>
        <TabsTrigger value="sessions">{t("tabs.sessions")}</TabsTrigger>
        {showDeveloperTab && <TabsTrigger value="developer">{t("tabs.developer")}</TabsTrigger>}
      </TabsList>

      <TabsContent value="profile">
        <ProfileForm
          firstName={settings.firstName}
          lastName={settings.lastName}
          email={settings.email}
          phone={settings.phone}
          organization={settings.organization}
        />
      </TabsContent>

      <TabsContent value="security">
        <SecurityForm
          emailAlertsEnabled={settings.emailAlertsEnabled}
          smsAlertsEnabled={settings.smsAlertsEnabled}
          twoFactorEnabled={settings.twoFactorEnabled}
          webAuthnCredentials={settings.webAuthnCredentials}
          preferredAuthMethod={settings.preferredAuthMethod}
        />
      </TabsContent>

      <TabsContent value="accessibility">
        <AccessibilityForm
          seniorMode={settings.seniorMode}
          largeText={settings.largeText}
          highContrast={settings.highContrast}
          reducedMotion={settings.reducedMotion}
          voiceResponses={settings.voiceResponses}
          uiLocale={settings.uiLocale}
        />
      </TabsContent>

      <TabsContent value="risk-engine">
        <RiskEngineForm
          adaptiveLearningEnabled={settings.adaptiveLearningEnabled}
          mediumRiskThreshold={settings.mediumRiskThreshold}
          highRiskThreshold={settings.highRiskThreshold}
          riskEngineDemoMode={settings.riskEngineDemoMode}
        />
      </TabsContent>

      <TabsContent value="accounts">
        <ConnectedAccountsPanel accounts={settings.accounts} />
      </TabsContent>

      <TabsContent value="sessions">
        <SessionManagementPanel
          devices={devicesAndSessions.devices}
          sessions={devicesAndSessions.sessions}
        />
      </TabsContent>

      {showDeveloperTab && (
        <TabsContent value="developer">
          <DeveloperSettingsPanel
            showRiskDebugPanel={settings.showRiskDebugPanel}
            isDemo={settings.isDemo}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
