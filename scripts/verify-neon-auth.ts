import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    return { email, ok: false, reason: "user_missing" };
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  return {
    email,
    ok: match,
    role: user.role,
    reason: match ? "password_ok" : "password_mismatch",
  };
}

async function main() {
  const customer = await verifyLogin("demo@securebank.ai", "demo-password");
  const admin = await verifyLogin("analyst@securebank.ai", "admin-password");

  const demoUser = await prisma.user.findUniqueOrThrow({
    where: { email: "demo@securebank.ai" },
    include: {
      accounts: true,
      behavioralProfile: true,
      devices: true,
      sessions: { take: 3, orderBy: { startedAt: "desc" } },
    },
  });

  const finSummary = {
    fraudReports: await prisma.fraudReport.count(),
    finEvents: await prisma.finEvent.count(),
    clusters: await prisma.fraudCluster.count(),
    transactions: await prisma.transaction.count({
      where: { account: { userId: demoUser.id } },
    }),
  };

  console.log(
    JSON.stringify(
      {
        auth: { customer, admin },
        demoDashboard: {
          accounts: demoUser.accounts.length,
          balances: demoUser.accounts.map((a) => ({
            name: a.name,
            balance: a.balance,
          })),
          hasBehavioralProfile: Boolean(demoUser.behavioralProfile),
          devices: demoUser.devices.length,
          recentSessions: demoUser.sessions.length,
        },
        finSummary,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Auth verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
