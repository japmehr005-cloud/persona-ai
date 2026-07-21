import { prisma } from "@/lib/prisma";
import { generateDemoStatementCsv } from "@/prisma/seed-data";
import { runCsvImport } from "@/services/import/run-csv-import";

const DEMO_HISTORY_DAYS = 100;

export class ResetDemoDataError extends Error {}

/**
 * Wipes and regenerates a demo account's transaction history (Test Data
 * Reset, Settings → Developer Settings). Strictly scoped to
 * `User.isDemo === true` accounts — this is a destructive operation and
 * must never be reachable for a real customer record.
 */
export async function resetDemoData(userId: string): Promise<{ importedCount: number }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { accounts: true },
  });

  if (!user.isDemo) {
    throw new ResetDemoDataError("Test data reset is only available for demo accounts.");
  }

  const checkingAccount = user.accounts.find((account) => account.type === "CHECKING") ?? user.accounts[0];
  if (!checkingAccount) {
    throw new ResetDemoDataError("This account has no accounts to import a demo statement into.");
  }

  const accountIds = user.accounts.map((account) => account.id);

  await prisma.$transaction([
    prisma.alert.deleteMany({ where: { userId } }),
    prisma.contextSignal.deleteMany({ where: { userId } }),
    prisma.transaction.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.importJob.deleteMany({ where: { userId } }),
    prisma.behavioralProfile.deleteMany({ where: { userId } }),
    prisma.account.update({ where: { id: checkingAccount.id }, data: { balance: 124580.75 } }),
  ]);

  const csvText = generateDemoStatementCsv(new Date(), DEMO_HISTORY_DAYS);
  const result = await runCsvImport({
    userId,
    accountId: checkingAccount.id,
    filename: "settings-demo-reset.csv",
    csvText,
    mapping: { date: "Date", amount: "Amount", description: "Description", category: "Category" },
  });

  return { importedCount: result.importedCount };
}
