import { prisma } from "@/lib/prisma";
import { categorizeMerchant } from "@/services/import/categorizer";
import { normalizeRow, parseCsvText, type ColumnMapping } from "@/services/import/csv-parser";
import { recalculateBehavioralProfile } from "@/services/behavior-engine/profile-service";

export interface CsvImportResult {
  jobId: string;
  rowCount: number;
  importedCount: number;
  errors: { rowNumber: number; error: string }[];
}

export async function runCsvImport(params: {
  userId: string;
  accountId: string;
  filename: string;
  csvText: string;
  mapping: ColumnMapping;
}): Promise<CsvImportResult> {
  const { userId, accountId, filename, csvText, mapping } = params;

  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) {
    throw new Error("Account not found for this user.");
  }

  const { rows } = parseCsvText(csvText);

  const job = await prisma.importJob.create({
    data: {
      userId,
      filename,
      status: "PROCESSING",
      rowCount: rows.length,
    },
  });

  const errors: { rowNumber: number; error: string }[] = [];
  const transactionsToCreate: {
    accountId: string;
    importJobId: string;
    date: Date;
    amount: number;
    merchant: string;
    category: string;
    channel: "CARD" | "TRANSFER" | "ACH" | "ATM" | "ONLINE";
    status: "APPROVED";
  }[] = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 2; // account for header row + 1-based indexing
    const result = normalizeRow(raw, mapping, rowNumber);
    if (!result.ok) {
      errors.push({ rowNumber: result.rowNumber, error: result.error });
      return;
    }

    transactionsToCreate.push({
      accountId,
      importJobId: job.id,
      date: result.row.date,
      amount: result.row.amount,
      merchant: result.row.merchant,
      category: categorizeMerchant(result.row.merchant, result.row.categoryHint),
      channel: result.row.amount < 0 ? "CARD" : "TRANSFER",
      status: "APPROVED",
    });
  });

  if (transactionsToCreate.length > 0) {
    await prisma.transaction.createMany({ data: transactionsToCreate });
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      importedCount: transactionsToCreate.length,
      errorLog: errors.length > 0 ? errors : undefined,
      completedAt: new Date(),
    },
  });

  if (transactionsToCreate.length > 0) {
    await recalculateBehavioralProfile(userId);
  }

  return {
    jobId: job.id,
    rowCount: rows.length,
    importedCount: transactionsToCreate.length,
    errors,
  };
}
