import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Fingerprint, Receipt } from "lucide-react";

import { getUserDrilldown } from "@/services/admin/get-user-drilldown";
import { getAuditTrailForEntities } from "@/services/audit/get-audit-trail";
import { formatCurrency } from "@/lib/format";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PageBreadcrumbs } from "@/components/shared/page-breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { AuditTrail } from "@/components/shared/audit-trail";
import { ReadonlyTransactionsTable } from "@/features/admin/readonly-transactions-table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Customer profile" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserDrilldown(id);

  if (!user) notFound();

  const auditTrail = await getAuditTrailForEntities(user.recentTransactions.map((tx) => tx.id));

  return (
    <PageContainer>
      <PageBreadcrumbs items={[{ label: "Customers", href: "/admin/users" }, { label: user.name }]} />
      <PageHeader
        title={user.name}
        description={`${user.email} · Member since ${format(user.createdAt, "MMM yyyy")}`}
        actions={
          user.openAlertCount > 0 ? (
            <Badge variant="warning">{user.openAlertCount} open alerts</Badge>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {account.name} ···· {account.mask}
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Behavioral baseline</CardTitle>
            <CardDescription>
              {user.behavioralProfile
                ? `Updated ${format(user.behavioralProfile.updatedAt, "MMM d, yyyy")}`
                : "Not yet established"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.behavioralProfile ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Typical amount</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatCurrency(user.behavioralProfile.avgAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Tx per day</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {user.behavioralProfile.txPerDay.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">p95 amount</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatCurrency(user.behavioralProfile.p95Amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sample size</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {user.behavioralProfile.sampleSize}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                This customer hasn&apos;t imported enough history to build a baseline yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
          </CardHeader>
          <CardContent>
            {user.devices.length === 0 ? (
              <EmptyState icon={Fingerprint} title="No devices" description="No devices registered yet." />
            ) : (
              <ul className="space-y-2">
                {user.devices.map((device) => (
                  <li key={device.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{device.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(device.lastSeenAt, "MMM d")}
                      </span>
                      <Badge variant={device.trusted ? "success" : "outline"}>
                        {device.trusted ? "Trusted" : "Unverified"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Most recent activity across all accounts.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {user.recentTransactions.length === 0 ? (
            <div className="px-6">
              <EmptyState
                icon={Receipt}
                title="No transactions"
                description="This customer has no transaction history yet."
              />
            </div>
          ) : (
            <ReadonlyTransactionsTable transactions={user.recentTransactions} />
          )}
        </CardContent>
      </Card>

      {auditTrail.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Security events across this customer&apos;s recent transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <AuditTrail entries={auditTrail} />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
