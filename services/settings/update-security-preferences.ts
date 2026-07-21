import { prisma } from "@/lib/prisma";

export interface UpdateSecurityPreferencesInput {
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
}

export async function updateSecurityPreferences(
  userId: string,
  input: UpdateSecurityPreferencesInput
): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });
}
