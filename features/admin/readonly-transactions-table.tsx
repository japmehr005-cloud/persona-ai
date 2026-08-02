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
import type { UserDrilldown } from "@/services/admin/get-user-drilldown";

const STATUS_VARIANT: Record<UserDrilldown["recentTransactions"][number]["status"], "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  PAUSED_FOR_VERIFICATION: "warning",
  FLAGGED: "warning",
  DENIED: "destructive",
};

export function ReadonlyTransactionsTable({
  transactions,
}: {
  transactions: UserDrilldown["recentTransactions"];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Merchant</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Risk</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="text-muted-foreground">{format(tx.date, "MMM d, yyyy")}</TableCell>
            <TableCell className="font-medium text-foreground">{tx.merchant}</TableCell>
            <TableCell
              className={cn("tabular-nums", tx.amount < 0 ? "text-foreground" : "text-success")}
            >
              {formatSignedCurrency(tx.amount)}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[tx.status]}>{tx.status}</Badge>
            </TableCell>
            <TableCell>
              {tx.riskTier ? <RiskBadge tier={tx.riskTier as RiskTier} /> : <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
