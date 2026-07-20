"use server";

import { z } from "zod";

import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { runCsvImport, type CsvImportResult } from "@/services/import/run-csv-import";

const IMPORT_ATTEMPT_LIMIT = 5;
const IMPORT_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const confirmImportSchema = z.object({
  accountId: z.string().min(1),
  filename: z.string().min(1),
  csvText: z.string().min(1),
  mapping: z.object({
    date: z.string().min(1),
    amount: z.string().min(1),
    description: z.string().min(1),
    category: z.string().optional(),
  }),
});

export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;

export async function confirmCsvImportAction(
  input: ConfirmImportInput
): Promise<{ ok: true; result: CsvImportResult } | { ok: false; error: string }> {
  const user = await requireUser();

  const rateLimit = checkRateLimit(`csv-import:${user.id}`, IMPORT_ATTEMPT_LIMIT, IMPORT_ATTEMPT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return { ok: false, error: "Too many imports submitted recently. Please wait a few minutes and try again." };
  }

  const parsed = confirmImportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid import request." };
  }

  try {
    const result = await runCsvImport({
      userId: user.id,
      accountId: parsed.data.accountId,
      filename: parsed.data.filename,
      csvText: parsed.data.csvText,
      mapping: parsed.data.mapping,
    });
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed unexpectedly.";
    return { ok: false, error: message };
  }
}
