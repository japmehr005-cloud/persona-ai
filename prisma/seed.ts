import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { runCsvImport } from "@/services/import/run-csv-import";
import { generateDemoStatementCsv } from "@/prisma/seed-data";

const DEMO_HISTORY_DAYS = 100;

async function main() {
  const demoPasswordHash = await bcrypt.hash("demo-password", 12);
  const adminPasswordHash = await bcrypt.hash("admin-password", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@securebank.ai" },
    update: { firstName: "Arjun", lastName: "Mehta" },
    create: {
      email: "demo@securebank.ai",
      passwordHash: demoPasswordHash,
      firstName: "Arjun",
      lastName: "Mehta",
      role: "CUSTOMER",
      isDemo: true,
      accounts: {
        create: [
          { name: "Primary Checking", mask: "4821", type: "CHECKING", balance: 124580.75 },
          { name: "Savings", mask: "1190", type: "SAVINGS", balance: 385200.0 },
        ],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "analyst@securebank.ai" },
    update: { firstName: "Priya", lastName: "Nair" },
    create: {
      email: "analyst@securebank.ai",
      passwordHash: adminPasswordHash,
      firstName: "Priya",
      lastName: "Nair",
      role: "ADMIN",
      isDemo: false,
    },
  });

  console.log("Seeded demo user:", demoUser.email);

  const checkingAccount = await prisma.account.findFirstOrThrow({
    where: { userId: demoUser.id, type: "CHECKING" },
  });
  const existingTransactionCount = await prisma.transaction.count({
    where: { accountId: checkingAccount.id },
  });

  if (existingTransactionCount === 0) {
    const csvText = generateDemoStatementCsv(new Date(), DEMO_HISTORY_DAYS);
    const result = await runCsvImport({
      userId: demoUser.id,
      accountId: checkingAccount.id,
      filename: "seed-demo-history.csv",
      csvText,
      mapping: { date: "Date", amount: "Amount", description: "Description", category: "Category" },
    });
    console.log(`Seeded ${result.importedCount} demo transactions and calculated the behavioral baseline.`);
  } else {
    console.log("Demo account already has transaction history, skipping synthetic history seed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
