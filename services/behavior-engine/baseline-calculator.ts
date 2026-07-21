export interface TransactionSample {
  date: Date;
  amount: number;
  merchant: string;
}

export interface MerchantFrequency {
  merchant: string;
  count: number;
  totalAmount: number;
}

export interface BehavioralBaseline {
  avgAmount: number;
  medianAmount: number;
  p95Amount: number;
  stdDevAmount: number;
  txPerDay: number;
  topMerchants: MerchantFrequency[];
  /** Relative frequency of spending transactions per hour of day (0-23), summing to 1. */
  activeHours: number[];
  /** Relative frequency of spending transactions per weekday (0=Sun..6=Sat), summing to 1. */
  activeDays: number[];
  sampleSize: number;
}

const TOP_MERCHANT_LIMIT = 8;

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor((p / 100) * sortedValues.length)
  );
  return sortedValues[index];
}

/**
 * Builds a personal behavioral baseline from a user's historical spending
 * transactions (debits only — incoming transfers/income are excluded so the
 * baseline reflects outgoing spending behavior, which is what the Risk
 * Engine compares new transactions against).
 */
export function calculateBehavioralBaseline(
  transactions: TransactionSample[]
): BehavioralBaseline {
  const spendAmounts = transactions.map((tx) => Math.abs(tx.amount)).sort((a, b) => a - b);
  const sampleSize = transactions.length;

  const avgAmount = spendAmounts.reduce((sum, v) => sum + v, 0) / (sampleSize || 1);
  const medianAmount = percentile(spendAmounts, 50);
  const p95Amount = percentile(spendAmounts, 95);
  const variance =
    spendAmounts.reduce((sum, v) => sum + (v - avgAmount) ** 2, 0) / (sampleSize || 1);
  const stdDevAmount = Math.sqrt(variance);

  const dateRange = transactions.reduce(
    (range, tx) => ({
      min: tx.date < range.min ? tx.date : range.min,
      max: tx.date > range.max ? tx.date : range.max,
    }),
    { min: transactions[0]?.date ?? new Date(), max: transactions[0]?.date ?? new Date() }
  );
  const daySpan = Math.max(
    1,
    Math.ceil((dateRange.max.getTime() - dateRange.min.getTime()) / (1000 * 60 * 60 * 24))
  );
  const txPerDay = sampleSize / daySpan;

  const merchantMap = new Map<string, MerchantFrequency>();
  for (const tx of transactions) {
    const existing = merchantMap.get(tx.merchant);
    if (existing) {
      existing.count += 1;
      existing.totalAmount += Math.abs(tx.amount);
    } else {
      merchantMap.set(tx.merchant, { merchant: tx.merchant, count: 1, totalAmount: Math.abs(tx.amount) });
    }
  }
  const topMerchants = Array.from(merchantMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_MERCHANT_LIMIT);

  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  for (const tx of transactions) {
    hourCounts[tx.date.getHours()] += 1;
    dayCounts[tx.date.getDay()] += 1;
  }
  const hourTotal = hourCounts.reduce((sum, v) => sum + v, 0) || 1;
  const activeHours = hourCounts.map((count) => count / hourTotal);
  const dayTotal = dayCounts.reduce((sum, v) => sum + v, 0) || 1;
  const activeDays = dayCounts.map((count) => count / dayTotal);

  return {
    avgAmount,
    medianAmount,
    p95Amount,
    stdDevAmount,
    txPerDay,
    topMerchants,
    activeHours,
    activeDays,
    sampleSize,
  };
}
