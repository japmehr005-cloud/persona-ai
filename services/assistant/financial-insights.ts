import { format, startOfMonth, subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";

export interface FinancialInsight {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "positive";
  metricLabel?: string;
  metricValue?: string;
}

function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * Proactive insights derived only from the customer's real transaction data.
 * Numbers are never invented by an LLM.
 */
export async function buildFinancialInsights(userId: string): Promise<FinancialInsight[]> {
  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const windowStart = startOfMonth(subMonths(now, 2));

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      date: { gte: windowStart },
      amount: { lt: 0 },
      status: { in: ["APPROVED", "FLAGGED", "PENDING"] },
    },
    select: { date: true, amount: true, category: true, merchant: true },
  });

  const insights: FinancialInsight[] = [];

  const thisMonth = transactions.filter((tx) => tx.date >= thisMonthStart);
  const prevMonth = transactions.filter(
    (tx) => tx.date >= prevMonthStart && tx.date < thisMonthStart
  );

  const sumAbs = (rows: typeof transactions) =>
    rows.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

  const thisTotal = sumAbs(thisMonth);
  const prevTotal = sumAbs(prevMonth);

  if (prevTotal > 0) {
    const deltaPct = ((thisTotal - prevTotal) / prevTotal) * 100;
    if (Math.abs(deltaPct) >= 8) {
      insights.push({
        id: "mom-total",
        title:
          deltaPct > 0
            ? `Spending is up ${Math.round(deltaPct)}% vs last month`
            : `Spending is down ${Math.round(Math.abs(deltaPct))}% vs last month`,
        detail: `You spent ${inr(thisTotal)} so far this month versus ${inr(prevTotal)} last month.`,
        severity: deltaPct > 15 ? "warning" : deltaPct < 0 ? "positive" : "info",
        metricLabel: "This month",
        metricValue: inr(thisTotal),
      });
    }
  }

  const categories = new Set([
    ...thisMonth.map((tx) => tx.category),
    ...prevMonth.map((tx) => tx.category),
  ]);

  for (const category of categories) {
    const cur = sumAbs(thisMonth.filter((tx) => tx.category === category));
    const prev = sumAbs(prevMonth.filter((tx) => tx.category === category));
    if (prev < 500 && cur < 1000) continue;
    if (prev === 0 && cur >= 2000) {
      insights.push({
        id: `cat-new-${category}`,
        title: `New ${category} spending this month`,
        detail: `You spent ${inr(cur)} on ${category}, with no comparable spend last month.`,
        severity: "info",
        metricLabel: category,
        metricValue: inr(cur),
      });
      continue;
    }
    if (prev > 0) {
      const deltaPct = ((cur - prev) / prev) * 100;
      const deltaAbs = cur - prev;
      if (deltaPct >= 20 && deltaAbs >= 500) {
        insights.push({
          id: `cat-up-${category}`,
          title: `You spent ${Math.round(deltaPct)}% more on ${category}`,
          detail: `${category} rose by ${inr(deltaAbs)} (${inr(prev)} → ${inr(cur)}).`,
          severity: deltaPct >= 40 ? "warning" : "info",
          metricLabel: category,
          metricValue: inr(cur),
        });
      }
    }
  }

  const merchantTotals = new Map<string, number>();
  for (const tx of thisMonth) {
    merchantTotals.set(
      tx.merchant,
      (merchantTotals.get(tx.merchant) ?? 0) + Math.abs(Number(tx.amount))
    );
  }
  const topMerchants = Array.from(merchantTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topMerchants.length > 0) {
    insights.push({
      id: "top-merchants",
      title: "Merchants you visit most this month",
      detail: topMerchants.map(([m, amt]) => `${m} (${inr(amt)})`).join(" · "),
      severity: "info",
    });
  }

  const subscriptionLike = thisMonth.filter(
    (tx) =>
      tx.category === "Subscriptions" ||
      /netflix|spotify|prime|subscription|membership|gym/i.test(tx.merchant)
  );
  const uniqueSubs = Array.from(
    new Map(subscriptionLike.map((tx) => [tx.merchant, Math.abs(Number(tx.amount))])).entries()
  );
  if (uniqueSubs.length >= 2) {
    const subTotal = uniqueSubs.reduce((sum, [, amt]) => sum + amt, 0);
    insights.push({
      id: "subscriptions",
      title: `${uniqueSubs.length} recurring subscriptions detected`,
      detail: `About ${inr(subTotal)}/month across ${uniqueSubs
        .slice(0, 4)
        .map(([m]) => m)
        .join(", ")}${uniqueSubs.length > 4 ? "…" : ""}. Review unused ones to save.`,
      severity: "warning",
      metricLabel: "Potential review",
      metricValue: inr(subTotal),
    });
  }

  // Simple save estimate: 15% of the largest category overspend vs last month
  const overspendInsights = insights.filter((i) => i.id.startsWith("cat-up-"));
  if (overspendInsights.length > 0) {
    const saveEstimate = Math.round(
      overspendInsights.reduce((sum, i) => {
        const match = i.detail.match(/rose by ₹([\d,]+)/);
        const value = match ? Number(match[1].replace(/,/g, "")) : 0;
        return sum + value * 0.35;
      }, 0)
    );
    if (saveEstimate >= 500) {
      insights.push({
        id: "save-estimate",
        title: `You can potentially save ${inr(saveEstimate)} per month`,
        detail: `Based on categories that rose versus ${format(prevMonthStart, "MMMM")}, trimming overspend by about one-third would free up ${inr(saveEstimate)}.`,
        severity: "positive",
        metricLabel: "Save opportunity",
        metricValue: inr(saveEstimate),
      });
    }
  }

  return insights.slice(0, 8);
}
