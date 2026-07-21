import { Landmark } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserSettingsAccountView } from "@/services/settings/get-user-settings";

export function ConnectedAccountsPanel({ accounts }: { accounts: UserSettingsAccountView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>Accounts linked to your Persona AI profile.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Landmark className="size-4.5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{account.name}</p>
                  <p className="text-xs text-muted-foreground">···· {account.mask}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{account.type}</Badge>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {formatCurrency(account.balance)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
