import { prisma } from "@/lib/prisma";
import { categorizeMerchant } from "@/services/import/categorizer";
import { normalizeRow, parseCsvText, type ColumnMapping } from "@/services/import/csv-parser";
import { recalculateBehavioralProfile } from "@/services/behavior-engine/profile-service";
import { resolveTransactionCategory } from "@/services/transaction-ai/client";

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

  const aiCategoryCache = new Map<string, string>();

  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index];
    const rowNumber = index + 2; // account for header row + 1-based indexing
    const result = normalizeRow(raw, mapping, rowNumber);
    if (!result.ok) {
      errors.push({ rowNumber: result.rowNumber, error: result.error });
      continue;
    }

    const keywordCategory = categorizeMerchant(result.row.merchant, result.row.categoryHint);
    let category = keywordCategory;
    // Prefer cached AI classification per merchant to avoid N sidecar calls.
    if (!result.row.categoryHint) {
      const cached = aiCategoryCache.get(result.row.merchant);
      if (cached) {
        category = cached;
      } else {
        const resolved = await resolveTransactionCategory({
          merchant: result.row.merchant,
          keywordCategory,
        });
        category = resolved.category;
        aiCategoryCache.set(result.row.merchant, category);
      }
    }

    transactionsToCreate.push({
      accountId,
      importJobId: job.id,
      date: result.row.date,
      amount: result.row.amount,
      merchant: result.row.merchant,
      category,
      channel: result.row.amount < 0 ? "CARD" : "TRANSFER",
      status: "APPROVED",
    });
  }

  // Persist the imported rows and mark the job complete atomically, so a
  // crash or aborted request between the two writes can never leave an
  // ImportJob marked COMPLETED without its transactions (or vice versa).
  await prisma.$transaction([
    ...(transactionsToCreate.length > 0
      ? [prisma.transaction.createMany({ data: transactionsToCreate })]
      : []),
    prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        importedCount: transactionsToCreate.length,
        errorLog: errors.length > 0 ? errors : undefined,
        completedAt: new Date(),
      },
    }),
  ]);

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
