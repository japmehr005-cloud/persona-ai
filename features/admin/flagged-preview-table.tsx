import { format } from "date-fns";

import { formatSignedCurrency } from "@/lib/format";
import { RiskBadge } from "@/components/shared/risk-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminOverview } from "@/services/admin/get-overview";

export function FlaggedPreviewTable({
  transactions,
}: {
  transactions: AdminOverview["topFlaggedTransactions"];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Merchant</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Risk</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell className="text-muted-foreground">{format(tx.date, "MMM d, h:mm a")}</TableCell>
            <TableCell className="font-medium text-foreground">{tx.customerName}</TableCell>
            <TableCell>{tx.merchant}</TableCell>
            <TableCell className="tabular-nums">{formatSignedCurrency(tx.amount)}</TableCell>
            <TableCell className="tabular-nums">{tx.score}</TableCell>
            <TableCell>
              <RiskBadge tier={tx.tier} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
