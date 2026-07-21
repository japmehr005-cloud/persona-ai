import { prisma } from "@/lib/prisma";

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  phone: string | null;
  organization: string | null;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { firstName: input.firstName, lastName: input.lastName },
    }),
    prisma.userSettings.upsert({
      where: { userId },
      create: { userId, phone: input.phone, organization: input.organization },
      update: { phone: input.phone, organization: input.organization },
    }),
  ]);
}
