import Papa from "papaparse";

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  category?: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvText(csvText: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  };
}

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "transaction date", "posted date", "posting date"],
  amount: ["amount", "value", "debit/credit", "transaction amount"],
  description: ["description", "merchant", "payee", "name", "details", "narrative"],
  category: ["category", "type", "classification"],
};

export function detectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};

  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    for (const [field, hints] of Object.entries(HEADER_HINTS) as [
      keyof ColumnMapping,
      string[],
    ][]) {
      if (mapping[field]) continue;
      if (hints.some((hint) => normalized === hint || normalized.includes(hint))) {
        mapping[field] = header;
      }
    }
  }

  return mapping;
}

export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  const isParenthesizedNegative = /^\(.*\)$/.test(value);
  value = value.replace(/[()]/g, "");
  value = value.replace(/[^0-9.,-]/g, "");
  value = value.replace(/,/g, "");

  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;

  return isParenthesizedNegative ? -Math.abs(parsed) : parsed;
}

const DATE_PATTERNS: RegExp[] = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
];

export function parseTransactionDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (DATE_PATTERNS[0].test(value)) {
    const [, year, month, day] = DATE_PATTERNS[0].exec(value)!;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  if (DATE_PATTERNS[1].test(value)) {
    const [, month, day, year] = DATE_PATTERNS[1].exec(value)!;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  if (DATE_PATTERNS[2].test(value)) {
    const [, month, day, year] = DATE_PATTERNS[2].exec(value)!;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export interface NormalizedRow {
  date: Date;
  amount: number;
  merchant: string;
  categoryHint?: string;
}

export type NormalizeRowResult =
  | { ok: true; row: NormalizedRow }
  | { ok: false; error: string; rowNumber: number };

export function normalizeRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  rowNumber: number
): NormalizeRowResult {
  const date = parseTransactionDate(raw[mapping.date]);
  const amount = parseAmount(raw[mapping.amount]);
  const merchant = raw[mapping.description]?.trim();

  if (!date) return { ok: false, error: "Could not parse date", rowNumber };
  if (amount === null) return { ok: false, error: "Could not parse amount", rowNumber };
  if (!merchant) return { ok: false, error: "Missing merchant/description", rowNumber };

  return {
    ok: true,
    row: {
      date,
      amount,
      merchant,
      categoryHint: mapping.category ? raw[mapping.category]?.trim() : undefined,
    },
  };
}
