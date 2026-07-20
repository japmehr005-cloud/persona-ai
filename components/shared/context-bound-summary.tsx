import { format } from "date-fns";
import { Lock } from "lucide-react";

import { formatSignedCurrency } from "@/lib/format";

export interface ContextBoundSummaryProps {
  merchant: string;
  amount: number;
  beneficiary: string | null;
  date: Date;
}

/**
 * Shows the exact transaction context an OTP challenge is bound to, so the
 * customer can visually confirm what they're authorizing before entering a
 * code — reinforcing that this code cannot be reused for a different
 * amount or payee.
 */
export function ContextBoundSummary({ merchant, amount, beneficiary, date }: ContextBoundSummaryProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Lock className="size-3.5" />
        Locked to this transaction
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Merchant</dt>
          <dd className="font-medium text-foreground">{merchant}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Amount</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatSignedCurrency(amount)}</dd>
        </div>
        {beneficiary && (
          <div>
            <dt className="text-xs text-muted-foreground">Beneficiary</dt>
            <dd className="font-medium text-foreground">{beneficiary}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Initiated</dt>
          <dd className="font-medium text-foreground">{format(date, "MMM d, yyyy 'at' h:mm a")}</dd>
        </div>
      </dl>
    </div>
  );
}
