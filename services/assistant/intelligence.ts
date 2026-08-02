import {
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

import { prisma } from "@/lib/prisma";

export interface IntelligenceMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

export interface SubscriptionItem {
  merchant: string;
  monthlyAmount: number;
  occurrences: number;
  category: string;
}

export interface MerchantStat {
  merchant: string;
  amount: number;
  count: number;
}

export interface CategoryTrend {
  category: string;
  thisMonth: number;
  lastMonth: number;
  deltaPct: number | null;
}

export interface FinancialIntelligence {
  balance: number;
  monthlySpend: number;
  previousMonthSpend: number;
  weekSpend: number;
  yesterdaySpend: number;
  incomeThisMonth: number;
  cashFlow: number;
  predictedMonthEndSpend: number;
  projectedSavings: number;
  weekendSpend: number;
  nightSpend: number;
  travelFrequency: number;
  largestPurchases: Array<{
    merchant: string;
    amount: number;
    date: string;
    category: string;
  }>;
  topMerchants: MerchantStat[];
  categoryTrends: CategoryTrend[];
  subscriptions: SubscriptionItem[];
  unusedSubscriptions: SubscriptionItem[];
  impulseSpendEstimate: number;
  foodSpendThisMonth: number;
  foodSpendThisWeek: number;
  metrics: IntelligenceMetric[];
}

function inr(amount: number): string {
  return `₹${Math.round(Math.abs(amount)).toLocaleString("en-IN")}`;
}

function sumAbs(
  rows: Array<{ amount: unknown }>,
  predicate?: (row: { amount: unknown; date?: Date; category?: string; merchant?: string }) => boolean
): number {
  return rows
    .filter((row) => (predicate ? predicate(row) : true))
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
}

const SUB_PATTERN = /netflix|spotify|prime|subscription|membership|gym|hotstar|youtube|adobe|microsoft 365|icloud/i;

/**
 * Deep financial intelligence derived only from the customer's ledger.
 */
export async function buildFinancialIntelligence(userId: string): Promise<FinancialIntelligence> {
  const accounts = await prisma.account.findMany({ where: { userId } });
  const accountIds = accounts.map((a) => a.id);
  const balance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  const empty: FinancialIntelligence = {
    balance,
    monthlySpend: 0,
    previousMonthSpend: 0,
    weekSpend: 0,
    yesterdaySpend: 0,
    incomeThisMonth: 0,
    cashFlow: 0,
    predictedMonthEndSpend: 0,
    projectedSavings: 0,
    weekendSpend: 0,
    nightSpend: 0,
    travelFrequency: 0,
    largestPurchases: [],
    topMerchants: [],
    categoryTrends: [],
    subscriptions: [],
    unusedSubscriptions: [],
    impulseSpendEstimate: 0,
    foodSpendThisMonth: 0,
    foodSpendThisWeek: 0,
    metrics: [],
  };

  if (accountIds.length === 0) return empty;

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const yesterdayStart = startOfDay(subDays(now, 1));
  const todayStart = startOfDay(now);
  const historyStart = startOfMonth(subMonths(now, 3));

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      date: { gte: historyStart },
      status: { in: ["APPROVED", "FLAGGED", "PENDING"] },
    },
    select: { date: true, amount: true, category: true, merchant: true },
    orderBy: { date: "desc" },
  });

  const debits = transactions.filter((tx) => Number(tx.amount) < 0);
  const credits = transactions.filter((tx) => Number(tx.amount) > 0);

  const thisMonth = debits.filter((tx) => tx.date >= thisMonthStart);
  const prevMonth = debits.filter((tx) => tx.date >= prevMonthStart && tx.date < thisMonthStart);
  const thisWeek = debits.filter((tx) => tx.date >= weekStart);
  const yesterday = debits.filter((tx) => tx.date >= yesterdayStart && tx.date < todayStart);

  const monthlySpend = sumAbs(thisMonth);
  const previousMonthSpend = sumAbs(prevMonth);
  const weekSpend = sumAbs(thisWeek);
  const yesterdaySpend = sumAbs(yesterday);
  const incomeThisMonth = sumAbs(credits.filter((tx) => tx.date >= thisMonthStart));
  const cashFlow = incomeThisMonth - monthlySpend;

  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const predictedMonthEndSpend = Math.round((monthlySpend / dayOfMonth) * daysInMonth);
  const projectedSavings = Math.max(0, Math.round(incomeThisMonth - predictedMonthEndSpend));

  const weekendSpend = sumAbs(thisMonth.filter((tx) => {
    const day = tx.date.getDay();
    return day === 0 || day === 6;
  }));
  const nightSpend = sumAbs(thisMonth.filter((tx) => {
    const hour = tx.date.getHours();
    return hour >= 22 || hour < 6;
  }));

  const travelTx = thisMonth.filter((tx) => /travel|transport/i.test(tx.category));
  const travelFrequency = travelTx.length;

  const foodCats = /food|dining|groceries/i;
  const foodSpendThisMonth = sumAbs(thisMonth.filter((tx) => foodCats.test(tx.category)));
  const foodSpendThisWeek = sumAbs(thisWeek.filter((tx) => foodCats.test(tx.category)));

  const largestPurchases = [...thisMonth]
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
    .slice(0, 5)
    .map((tx) => ({
      merchant: tx.merchant,
      amount: Math.abs(Number(tx.amount)),
      date: tx.date.toISOString(),
      category: tx.category,
    }));

  const merchantMap = new Map<string, MerchantStat>();
  for (const tx of thisMonth) {
    const existing = merchantMap.get(tx.merchant) ?? {
      merchant: tx.merchant,
      amount: 0,
      count: 0,
    };
    existing.amount += Math.abs(Number(tx.amount));
    existing.count += 1;
    merchantMap.set(tx.merchant, existing);
  }
  const topMerchants = Array.from(merchantMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const categories = new Set([
    ...thisMonth.map((tx) => tx.category),
    ...prevMonth.map((tx) => tx.category),
  ]);
  const categoryTrends: CategoryTrend[] = Array.from(categories)
    .map((category) => {
      const cur = sumAbs(thisMonth.filter((tx) => tx.category === category));
      const prev = sumAbs(prevMonth.filter((tx) => tx.category === category));
      return {
        category,
        thisMonth: cur,
        lastMonth: prev,
        deltaPct: prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : null,
      };
    })
    .sort((a, b) => b.thisMonth - a.thisMonth)
    .slice(0, 8);

  // Subscription detection: same merchant 2+ times in 90 days, similar amount
  const ninetyDays = debits.filter((tx) => tx.date >= subDays(now, 90));
  const byMerchant = new Map<string, typeof ninetyDays>();
  for (const tx of ninetyDays) {
    const list = byMerchant.get(tx.merchant) ?? [];
    list.push(tx);
    byMerchant.set(tx.merchant, list);
  }

  const subscriptions: SubscriptionItem[] = [];
  for (const [merchant, rows] of byMerchant) {
    const isNamedSub = SUB_PATTERN.test(merchant) || rows.some((r) => r.category === "Subscriptions");
    if (rows.length < 2 && !isNamedSub) continue;
    if (rows.length < 2) continue;
    const amounts = rows.map((r) => Math.abs(Number(r.amount)));
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const similar = amounts.every((a) => Math.abs(a - avg) / avg < 0.35);
    if (!similar && !isNamedSub) continue;
    subscriptions.push({
      merchant,
      monthlyAmount: avg,
      occurrences: rows.length,
      category: rows[0]?.category ?? "Subscriptions",
    });
  }
  subscriptions.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  // Unused: subscription merchants with no spend in last 35 days but present in prior window
  const unusedSubscriptions = subscriptions.filter((sub) => {
    const recent = thisMonth.some((tx) => tx.merchant === sub.merchant);
    const older = prevMonth.some((tx) => tx.merchant === sub.merchant);
    return older && !recent;
  });

  // Impulse: dining/shopping under ₹2,500 outside business hours
  const impulseSpendEstimate = sumAbs(
    thisMonth.filter((tx) => {
      const hour = tx.date.getHours();
      const amt = Math.abs(Number(tx.amount));
      return amt < 2500 && (hour >= 20 || hour < 7) && /dining|shopping|entertainment/i.test(tx.category);
    })
  );

  const metrics: IntelligenceMetric[] = [
    {
      id: "cashflow",
      label: "Cash flow (MTD)",
      value: inr(cashFlow),
      detail:
        cashFlow >= 0
          ? "Income exceeds spending so far this month."
          : "Spending exceeds recorded income this month.",
      tone: cashFlow >= 0 ? "positive" : "warning",
    },
    {
      id: "predict",
      label: "Predicted month-end spend",
      value: inr(predictedMonthEndSpend),
      detail: `Based on ${inr(monthlySpend)} spent across ${dayOfMonth} days.`,
      tone: predictedMonthEndSpend > previousMonthSpend * 1.15 ? "warning" : "neutral",
    },
    {
      id: "weekend",
      label: "Weekend spending",
      value: inr(weekendSpend),
      detail: `${monthlySpend > 0 ? Math.round((weekendSpend / monthlySpend) * 100) : 0}% of this month's spend.`,
      tone: weekendSpend > monthlySpend * 0.4 ? "warning" : "neutral",
    },
    {
      id: "night",
      label: "Night spending",
      value: inr(nightSpend),
      detail: "Transactions between 10 PM and 6 AM.",
      tone: nightSpend > monthlySpend * 0.25 ? "warning" : "neutral",
    },
    {
      id: "travel",
      label: "Travel frequency",
      value: `${travelFrequency} trips`,
      detail: "Travel/transport transactions this month.",
      tone: "neutral",
    },
    {
      id: "impulse",
      label: "Impulse spend estimate",
      value: inr(impulseSpendEstimate),
      detail: "Small evening shopping/dining purchases.",
      tone: impulseSpendEstimate > 3000 ? "warning" : "neutral",
    },
  ];

  if (unusedSubscriptions.length > 0) {
    metrics.push({
      id: "unused-subs",
      label: "Unused subscriptions",
      value: String(unusedSubscriptions.length),
      detail: unusedSubscriptions.map((s) => s.merchant).join(", "),
      tone: "warning",
    });
  }

  return {
    balance,
    monthlySpend,
    previousMonthSpend,
    weekSpend,
    yesterdaySpend,
    incomeThisMonth,
    cashFlow,
    predictedMonthEndSpend,
    projectedSavings,
    weekendSpend,
    nightSpend,
    travelFrequency,
    largestPurchases,
    topMerchants,
    categoryTrends,
    subscriptions: subscriptions.slice(0, 8),
    unusedSubscriptions: unusedSubscriptions.slice(0, 5),
    impulseSpendEstimate,
    foodSpendThisMonth,
    foodSpendThisWeek,
    metrics,
  };
}

export function formatInr(amount: number): string {
  return inr(amount);
}

export function monthLabel(date = new Date()): string {
  return format(date, "MMMM yyyy");
}
