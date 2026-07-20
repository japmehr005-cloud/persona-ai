"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { DispositionSlice } from "@/services/admin/get-analytics";

const LABELS: Record<DispositionSlice["disposition"], string> = {
  UNREVIEWED: "Unreviewed",
  CONFIRMED_FRAUD: "Confirmed fraud",
  FALSE_POSITIVE: "False positive",
  ESCALATED: "Escalated",
};

const COLORS: Record<DispositionSlice["disposition"], string> = {
  UNREVIEWED: "var(--color-muted-foreground)",
  CONFIRMED_FRAUD: "var(--color-destructive)",
  FALSE_POSITIVE: "var(--color-success)",
  ESCALATED: "var(--color-warning)",
};

export function DispositionDonutChart({ data }: { data: DispositionSlice[] }) {
  const chartData = data.filter((slice) => slice.count > 0);

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="100%" height={180} className="max-w-[180px]">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="disposition"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            strokeWidth={0}
          >
            {chartData.map((slice) => (
              <Cell key={slice.disposition} fill={COLORS[slice.disposition]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, item) => [`${value}`, LABELS[item.payload.disposition as DispositionSlice["disposition"]]]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-2">
        {chartData.map((slice) => (
          <li key={slice.disposition} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: COLORS[slice.disposition] }} />
              {LABELS[slice.disposition]}
            </span>
            <span className="font-medium tabular-nums text-foreground">{slice.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
