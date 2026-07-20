"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Upload, AlertTriangle } from "lucide-react";

import {
  detectColumnMapping,
  normalizeRow,
  type ColumnMapping,
} from "@/services/import/csv-parser";
import { categorizeMerchant } from "@/services/import/categorizer";
import { confirmCsvImportAction } from "@/features/transactions/import-actions";
import { formatSignedCurrency } from "@/lib/format";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AccountOption {
  id: string;
  name: string;
  mask: string;
}

type WizardStep = "select" | "map" | "done";

const PREVIEW_ROW_LIMIT = 10;

export function CsvImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("select");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<{
    importedCount: number;
    rowCount: number;
    errorCount: number;
  } | null>(null);

  const handleFileSelected = async (file: File) => {
    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    const parsedHeaders = result.meta.fields ?? [];
    if (parsedHeaders.length === 0 || result.data.length === 0) {
      toast.error("We couldn't find any rows in that file. Check the CSV and try again.");
      return;
    }

    setFilename(file.name);
    setCsvText(text);
    setHeaders(parsedHeaders);
    setRows(result.data);
    setMapping(detectColumnMapping(parsedHeaders));
    setStep("map");
  };

  const previewRows = useMemo(() => {
    if (!mapping.date || !mapping.amount || !mapping.description) return [];

    return rows.slice(0, PREVIEW_ROW_LIMIT).map((raw, index) => {
      const result = normalizeRow(raw, mapping as ColumnMapping, index + 2);
      if (!result.ok) {
        return { ok: false as const, rowNumber: result.rowNumber, error: result.error };
      }
      return {
        ok: true as const,
        rowNumber: index + 2,
        date: result.row.date,
        amount: result.row.amount,
        merchant: result.row.merchant,
        category: categorizeMerchant(result.row.merchant, result.row.categoryHint),
      };
    });
  }, [rows, mapping]);

  const mappingComplete = Boolean(mapping.date && mapping.amount && mapping.description);

  const handleConfirm = async () => {
    if (!mappingComplete || !accountId) return;
    setIsSubmitting(true);

    const response = await confirmCsvImportAction({
      accountId,
      filename,
      csvText,
      mapping: mapping as ColumnMapping,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    setSummary({
      importedCount: response.result.importedCount,
      rowCount: response.result.rowCount,
      errorCount: response.result.errors.length,
    });
    setStep("done");
  };

  if (step === "done" && summary) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <p className="text-lg font-semibold text-foreground">Import complete</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Imported {summary.importedCount} of {summary.rowCount} rows
              {summary.errorCount > 0 && ` — ${summary.errorCount} skipped due to formatting issues`}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back to dashboard
            </Button>
            <Button onClick={() => router.push("/transactions")}>View transactions</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "map") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Map columns and review</CardTitle>
          <CardDescription>
            We detected these columns automatically. Adjust them if anything looks wrong, then
            review a preview of the first {PREVIEW_ROW_LIMIT} rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <MappingField
              label="Date column"
              value={mapping.date}
              headers={headers}
              onChange={(value) => setMapping((prev) => ({ ...prev, date: value }))}
            />
            <MappingField
              label="Amount column"
              value={mapping.amount}
              headers={headers}
              onChange={(value) => setMapping((prev) => ({ ...prev, amount: value }))}
            />
            <MappingField
              label="Merchant / description column"
              value={mapping.description}
              headers={headers}
              onChange={(value) => setMapping((prev) => ({ ...prev, description: value }))}
            />
          </div>

          {mappingComplete && (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) =>
                    row.ok ? (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{format(row.date, "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-medium text-foreground">{row.merchant}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.category}</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatSignedCurrency(row.amount)}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={row.rowNumber}>
                        <TableCell colSpan={4} className="text-warning">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="size-3.5" />
                            Row {row.rowNumber}: {row.error}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("select")} disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={handleConfirm} disabled={!mappingComplete || isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Import {rows.length} transactions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a bank statement</CardTitle>
        <CardDescription>
          CSV files exported from most banks are supported. We&apos;ll help you map the columns
          in the next step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="account">Import into account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id="account" className="w-full">
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} ···· {account.mask}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label
          htmlFor="csv-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center transition-colors hover:bg-accent/40"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Upload className="size-5" />
          </span>
          <span className="text-sm font-medium text-foreground">Click to choose a CSV file</span>
          <span className="text-xs text-muted-foreground">or drag and drop</span>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={!accountId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
        </label>

        <a
          href="/sample-statement.csv"
          download
          className="block text-center text-sm text-primary hover:underline"
        >
          Download a sample CSV to try the import flow
        </a>
      </CardContent>
    </Card>
  );
}

function MappingField({
  label,
  value,
  headers,
  onChange,
}: {
  label: string;
  value?: string;
  headers: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
