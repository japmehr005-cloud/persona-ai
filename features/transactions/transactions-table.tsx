"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";

import { formatSignedCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TRANSACTION_CATEGORIES } from "@/lib/constants";
import type { TransactionRow } from "@/services/transactions/get-user-transactions";
import { DataTable } from "@/components/tables/data-table";
import { RiskBadge, type RiskTier } from "@/components/shared/risk-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_VARIANT: Record<TransactionRow["status"], "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  PAUSED_FOR_VERIFICATION: "warning",
  FLAGGED: "warning",
  DENIED: "destructive",
};

const columns: ColumnDef<TransactionRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{format(row.original.date, "MMM d, yyyy")}</span>
    ),
    sortingFn: "datetime",
  },
  {
    accessorKey: "merchant",
    header: "Merchant",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.original.merchant}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.accountName} ···· {row.original.accountMask}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge>,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span
        className={cn(
          "tabular-nums font-medium",
          row.original.amount < 0 ? "text-foreground" : "text-success"
        )}
      >
        {formatSignedCurrency(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>
    ),
  },
  {
    accessorKey: "riskTier",
    header: "Risk",
    cell: ({ row }) =>
      row.original.riskTier ? (
        <RiskBadge tier={row.original.riskTier as RiskTier} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

export function TransactionsTable({
  transactions,
  initialSearch = "",
}: {
  transactions: TransactionRow[];
  initialSearch?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const availableCategories = useMemo(() => {
    const present = new Set(transactions.map((tx) => tx.category));
    return TRANSACTION_CATEGORIES.filter((category) => present.has(category));
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (search && !tx.merchant.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== "all" && tx.category !== category) return false;
      if (dateFrom && tx.date < new Date(dateFrom)) return false;
      if (dateTo && tx.date > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [transactions, search, category, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search merchants..."
            className="pl-8"
            aria-label="Search transactions by merchant"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {availableCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full sm:w-40"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full sm:w-40"
            aria-label="To date"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/transactions/${row.id}`)}
        emptyTitle="No matching transactions"
        emptyDescription="Try adjusting your search or filters."
      />
    </div>
  );
}
