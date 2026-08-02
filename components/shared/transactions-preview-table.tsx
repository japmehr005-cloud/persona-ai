import Link from "next/link";
import { format } from "date-fns";

import { formatSignedCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RiskBadge, type RiskTier } from "@/components/shared/risk-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardTransaction } from "@/services/dashboard/get-dashboard-summary";

const STATUS_VARIANT: Record<DashboardTransaction["status"], "success" | "warning" | "destructive" | "outline"> = {
  APPROVED: "success",
  PENDING: "warning",
  PAUSED_FOR_VERIFICATION: "warning",
  FLAGGED: "warning",
  DENIED: "destructive",
};

export function TransactionsPreviewTable({
  transactions,
}: {
  transactions: DashboardTransaction[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Merchant</TableHead>
          <TableHead className="hidden sm:table-cell">Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead className="hidden md:table-cell">Status</TableHead>
          <TableHead className="hidden lg:table-cell">Risk</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id} className="cursor-pointer">
            <TableCell className="p-0">
              <Link
                href={`/transactions/${tx.id}`}
                className="flex items-center px-4 py-3 text-muted-foreground"
              >
                {format(tx.date, "MMM d")}
              </Link>
            </TableCell>
            <TableCell className="p-0">
              <Link
                href={`/transactions/${tx.id}`}
                className="flex items-center px-4 py-3 font-medium text-foreground"
              >
                {tx.merchant}
              </Link>
            </TableCell>
            <TableCell className="hidden p-0 sm:table-cell">
              <Link
                href={`/transactions/${tx.id}`}
                className="flex items-center px-4 py-3 text-muted-foreground"
              >
                {tx.category}
              </Link>
            </TableCell>
            <TableCell className="p-0">
              <Link
                href={`/transactions/${tx.id}`}
                className={cn(
                  "flex items-center px-4 py-3 font-medium tabular-nums",
                  tx.amount < 0 ? "text-foreground" : "text-success"
                )}
              >
                {formatSignedCurrency(tx.amount)}
              </Link>
            </TableCell>
            <TableCell className="hidden p-0 md:table-cell">
              <Link href={`/transactions/${tx.id}`} className="flex items-center px-4 py-3">
                <Badge variant={STATUS_VARIANT[tx.status]}>{tx.status}</Badge>
              </Link>
            </TableCell>
            <TableCell className="hidden p-0 lg:table-cell">
              <Link href={`/transactions/${tx.id}`} className="flex items-center px-4 py-3">
                {tx.riskTier ? <RiskBadge tier={tx.riskTier as RiskTier} /> : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
