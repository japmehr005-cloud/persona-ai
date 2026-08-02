import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, firstName: true, lastName: true },
    orderBy: { email: "asc" },
  });

  const [
    accounts,
    transactions,
    behavioralProfiles,
    devices,
    sessions,
    sessionsWithRisk,
    fraudReports,
    finEvents,
    fraudClusters,
    clusterMembers,
    govRecords,
    importJobs,
    alerts,
    assistantThreads,
    riskAssessments,
    userSettings,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.transaction.count(),
    prisma.behavioralProfile.count(),
    prisma.device.count(),
    prisma.session.count(),
    prisma.session.count({
      where: { OR: [{ riskScore: { not: null } }, { riskTier: { not: null } }] },
    }),
    prisma.fraudReport.count(),
    prisma.finEvent.count(),
    prisma.fraudCluster.count(),
    prisma.fraudClusterMember.count(),
    prisma.governmentRiskRecord.count(),
    prisma.importJob.count(),
    prisma.alert.count(),
    prisma.assistantThread.count(),
    prisma.riskAssessment.count(),
    prisma.userSettings.count(),
  ]);

  const report = {
    connection: "ok",
    users: users.map((u) => ({
      email: u.email,
      role: u.role,
      name: `${u.firstName} ${u.lastName}`,
    })),
    counts: {
      users: users.length,
      accounts,
      transactions,
      behavioralProfiles,
      devices,
      sessions,
      sessionsWithRisk,
      fraudReports,
      finEvents,
      fraudClusters,
      clusterMembers,
      govRecords,
      importJobs,
      alerts,
      assistantThreads,
      riskAssessments,
      userSettings,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
