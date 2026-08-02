import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { getUserSettingsView } from "@/services/settings/get-user-settings";
import { getDevicesAndSessions } from "@/services/security/get-devices-and-sessions";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/features/settings/profile-form";
import { SecurityForm } from "@/features/settings/security-form";
import { RiskEngineForm } from "@/features/settings/risk-engine-form";
import { ConnectedAccountsPanel } from "@/features/settings/connected-accounts-panel";
import { SessionManagementPanel } from "@/features/settings/session-management-panel";
import { DeveloperSettingsPanel } from "@/features/settings/developer-settings-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, devicesAndSessions] = await Promise.all([
    getUserSettingsView(user.id),
    getDevicesAndSessions(user.id),
  ]);

  const showDeveloperTab = settings.isDemo || settings.demoModeBuildFlagEnabled || settings.riskEngineDemoMode;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Settings"
        description="Manage your profile, security preferences, and how the Adaptive Risk Engine evaluates your transactions."
      />

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="risk-engine">Risk Engine</TabsTrigger>
          <TabsTrigger value="accounts">Connected Accounts</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          {showDeveloperTab && <TabsTrigger value="developer">Developer</TabsTrigger>}
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
          <SessionManagementPanel devices={devicesAndSessions.devices} sessions={devicesAndSessions.sessions} />
        </TabsContent>

        {showDeveloperTab && (
          <TabsContent value="developer">
            <DeveloperSettingsPanel showRiskDebugPanel={settings.showRiskDebugPanel} isDemo={settings.isDemo} />
          </TabsContent>
        )}
      </Tabs>
    </PageContainer>
  );
}
