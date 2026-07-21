"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";

import type { UserDirectoryRow } from "@/services/admin/get-user-directory";
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

const columns: ColumnDef<UserDirectoryRow>[] = [
  {
    accessorKey: "name",
    header: "Customer",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  {
    accessorKey: "latestRiskTier",
    header: "Latest risk",
    cell: ({ row }) =>
      row.original.latestRiskTier ? (
        <RiskBadge tier={row.original.latestRiskTier as RiskTier} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "openAlertCount",
    header: "Open alerts",
    cell: ({ row }) =>
      row.original.openAlertCount > 0 ? (
        <Badge variant="warning">{row.original.openAlertCount}</Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  {
    accessorKey: "lastActivity",
    header: "Last activity",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.lastActivity ? format(row.original.lastActivity, "MMM d, yyyy") : "No activity"}
      </span>
    ),
    sortingFn: "datetime",
  },
];

export function UsersTable({ users }: { users: UserDirectoryRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const filtered = useMemo(() => {
    return users.filter((user) => {
      if (
        search &&
        !user.name.toLowerCase().includes(search.toLowerCase()) &&
        !user.email.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (riskFilter !== "all" && user.latestRiskTier !== riskFilter) return false;
      return true;
    });
  }, [users, search, riskFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email..."
            className="pl-8"
            aria-label="Search customers"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by risk tier">
            <SelectValue placeholder="All risk tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk tiers</SelectItem>
            <SelectItem value="LOW">Low risk</SelectItem>
            <SelectItem value="MEDIUM">Medium risk</SelectItem>
            <SelectItem value="HIGH">High risk</SelectItem>
            <SelectItem value="CRITICAL">Critical risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
        emptyTitle="No matching customers"
        emptyDescription="Try adjusting your search or filters."
      />
    </div>
  );
}
