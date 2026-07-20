"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface RiskDistributionPoint {
  tier: "LOW" | "MEDIUM" | "HIGH";
  count: number;
}

const TIER_LABELS: Record<RiskDistributionPoint["tier"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const TIER_COLORS: Record<RiskDistributionPoint["tier"], string> = {
  LOW: "var(--color-success)",
  MEDIUM: "var(--color-warning)",
  HIGH: "var(--color-destructive)",
};

export function RiskDistributionBar({ data }: { data: RiskDistributionPoint[] }) {
  const chartData = data.map((point) => ({ ...point, label: TIER_LABELS[point.tier] }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
        />
        <YAxis hide />
        <Tooltip
          formatter={(value) => `${value} transactions`}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {chartData.map((point) => (
            <Cell key={point.tier} fill={TIER_COLORS[point.tier]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
