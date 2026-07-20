interface RecurringCharge {
  merchant: string;
  category: string;
  intervalDays: number;
  amount: number;
}

interface WeightedMerchant {
  merchant: string;
  category: string;
  min: number;
  max: number;
  weight: number;
}

const RECURRING_CHARGES: RecurringCharge[] = [
  { merchant: "Salary Credit - Infosys", category: "Income", intervalDays: 14, amount: 45000 },
  { merchant: "Netflix Subscription", category: "Entertainment", intervalDays: 30, amount: -499 },
  { merchant: "Spotify Premium", category: "Entertainment", intervalDays: 30, amount: -119 },
  { merchant: "Airtel Broadband", category: "Utilities", intervalDays: 30, amount: -799 },
  { merchant: "Cult.fit Membership", category: "Subscriptions", intervalDays: 30, amount: -1499 },
];

const WEIGHTED_MERCHANTS: WeightedMerchant[] = [
  { merchant: "Chaayos", category: "Dining", min: 120, max: 350, weight: 10 },
  { merchant: "Swiggy", category: "Dining", min: 200, max: 650, weight: 7 },
  { merchant: "DMart", category: "Groceries", min: 500, max: 2000, weight: 6 },
  { merchant: "BigBasket", category: "Groceries", min: 400, max: 1500, weight: 5 },
  { merchant: "Blinkit", category: "Groceries", min: 150, max: 800, weight: 5 },
  { merchant: "Ola Cabs", category: "Transport", min: 100, max: 450, weight: 6 },
  { merchant: "Indian Oil Petrol Pump", category: "Transport", min: 500, max: 2000, weight: 4 },
  { merchant: "Zomato", category: "Dining", min: 200, max: 600, weight: 5 },
  { merchant: "Apollo Pharmacy", category: "Healthcare", min: 150, max: 1200, weight: 3 },
  { merchant: "Amazon India", category: "Shopping", min: 300, max: 3000, weight: 5 },
  { merchant: "Flipkart", category: "Shopping", min: 400, max: 2500, weight: 3 },
  { merchant: "Reliance Fresh", category: "Groceries", min: 500, max: 1800, weight: 4 },
  { merchant: "UPI Transfer to R. Sharma", category: "Transfer", min: 200, max: 3000, weight: 1 },
  { merchant: "Croma", category: "Shopping", min: 800, max: 5000, weight: 1 },
  { merchant: "IndiGo Airlines", category: "Travel", min: 3000, max: 9000, weight: 1 },
];

const TOTAL_WEIGHT = WEIGHTED_MERCHANTS.reduce((sum, item) => sum + item.weight, 0);

function pickWeightedMerchant(): WeightedMerchant {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const item of WEIGHTED_MERCHANTS) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return WEIGHTED_MERCHANTS[0];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function formatCsvRow(date: Date, description: string, amount: number, category: string): string {
  const iso = date.toISOString().slice(0, 19);
  return `${iso},${description},${amount.toFixed(2)},${category}`;
}

/**
 * Builds a synthetic CSV statement spanning `days` days up to `referenceDate`,
 * mixing scheduled recurring charges (payroll, subscriptions) with randomized
 * everyday spending, so a fresh demo account has a realistic transaction
 * history and behavioral baseline without requiring a manual CSV upload.
 */
export function generateDemoStatementCsv(referenceDate: Date, days: number): string {
  const rows: string[] = ["Date,Description,Amount,Category"];
  const startTime = referenceDate.getTime() - days * 24 * 60 * 60 * 1000;

  for (const charge of RECURRING_CHARGES) {
    for (let time = startTime; time <= referenceDate.getTime(); time += charge.intervalDays * 24 * 60 * 60 * 1000) {
      const date = new Date(time);
      date.setHours(0, 1, 0, 0);
      const jitter = charge.amount > 0 ? randomBetween(-1500, 2500) : randomBetween(-5, 5);
      rows.push(formatCsvRow(date, charge.merchant, charge.amount + jitter, charge.category));
    }
  }

  for (let dayOffset = 0; dayOffset <= days; dayOffset++) {
    const dayDate = new Date(startTime + dayOffset * 24 * 60 * 60 * 1000);
    const transactionsToday = Math.random() < 0.15 ? 0 : Math.random() < 0.7 ? 1 : 2;

    for (let i = 0; i < transactionsToday; i++) {
      const pick = pickWeightedMerchant();
      const amount = -randomBetween(pick.min, pick.max);
      const timestamp = new Date(dayDate);
      timestamp.setHours(Math.floor(randomBetween(7, 22)), Math.floor(randomBetween(0, 60)), 0, 0);
      rows.push(formatCsvRow(timestamp, pick.merchant, amount, pick.category));
    }
  }

  return rows.join("\n");
}
