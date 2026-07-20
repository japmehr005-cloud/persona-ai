import { TRANSACTION_CATEGORIES } from "@/lib/constants";

type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

const CATEGORY_KEYWORDS: Record<Exclude<TransactionCategory, "Other">, string[]> = {
  Groceries: ["walmart", "kroger", "whole foods", "trader joe", "safeway", "grocery", "supermarket", "aldi"],
  Dining: ["starbucks", "restaurant", "cafe", "coffee", "mcdonald", "chipotle", "doordash", "ubereats", "grubhub", "pizza"],
  Transport: ["uber", "lyft", "shell", "chevron", "exxon", "gas station", "parking", "transit", "metro"],
  Utilities: ["electric", "water utility", "internet", "comcast", "verizon", "at&t", "utility", "duke energy"],
  Entertainment: ["netflix", "spotify", "hulu", "disney", "cinema", "movie", "steam", "playstation", "xbox"],
  Shopping: ["amazon", "target", "best buy", "ebay", "etsy", "mall", "store"],
  Travel: ["airline", "airlines", "hotel", "marriott", "hilton", "airbnb", "expedia", "delta air", "united air"],
  Healthcare: ["pharmacy", "cvs", "walgreens", "hospital", "clinic", "dental", "doctor"],
  Transfer: ["transfer", "zelle", "venmo", "paypal", "wire transfer"],
  Income: ["payroll", "salary", "direct deposit", "employer"],
  Subscriptions: ["subscription", "membership", "gym"],
};

export function categorizeMerchant(merchant: string, categoryHint?: string): string {
  if (categoryHint) {
    const matched = TRANSACTION_CATEGORIES.find(
      (category) => category.toLowerCase() === categoryHint.toLowerCase()
    );
    if (matched) return matched;
  }

  const normalized = merchant.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return "Other";
}
