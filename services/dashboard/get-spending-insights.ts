import { eachMonthOfInterval, format, startOfMonth, subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";
import type { CategorySpend } from "@/components/charts/category-donut-chart";
import type { MonthlySpendingPoint } from "@/components/charts/spending-area-chart";

export interface SpendingInsights {
  monthlyTrend: MonthlySpendingPoint[];
  categoryBreakdown: CategorySpend[];
}

export async function getSpendingInsights(userId: string): Promise<SpendingInsights> {
  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
  const accountIds = accounts.map((account) => account.id);

  const rangeStart = startOfMonth(subMonths(new Date(), 5));
  const transactions = await prisma.transaction.findMany({
    where: { accountId: { in: accountIds }, date: { gte: rangeStart }, amount: { lt: 0 } },
    select: { date: true, amount: true, category: true },
  });

  const months = eachMonthOfInterval({ start: rangeStart, end: new Date() });
  const monthlyTrend: MonthlySpendingPoint[] = months.map((monthDate) => {
    const monthKey = format(monthDate, "yyyy-MM");
    const total = transactions
      .filter((tx) => format(tx.date, "yyyy-MM") === monthKey)
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
    return { month: format(monthDate, "MMM"), amount: total };
  });

  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + Math.abs(Number(tx.amount)));
  }
  const categoryBreakdown: CategorySpend[] = Array.from(byCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  return { monthlyTrend, categoryBreakdown };
}
