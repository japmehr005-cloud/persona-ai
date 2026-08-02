"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

import type { FinTrendPoint } from "@/services/admin/get-fin-overview";

/** A minimal, axis-free trend line for dense SOC panels — the full
 * labeled version lives on FIN Analytics (`FinEventTrendChart`). */
export function FinEventSparklineChart({ data }: { data: FinTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="finSparklineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          formatter={(value) => [`${value}`, "FIN events"]}
          labelFormatter={(label) => label}
          contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-primary)"
          fill="url(#finSparklineFill)"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
