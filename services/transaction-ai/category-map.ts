import { TRANSACTION_CATEGORIES } from "@/lib/constants";

export type AiTransactionCategory = "Food" | "Travel" | "Investment" | "Shopping" | "EMI";

type AppCategory = (typeof TRANSACTION_CATEGORIES)[number];

const AI_TO_APP: Record<string, AppCategory> = {
  Food: "Dining",
  Travel: "Travel",
  Shopping: "Shopping",
  EMI: "Subscriptions",
  Investment: "Other",
};

/** Maps Transaction Intelligence labels onto the app taxonomy. */
export function mapAiCategoryToApp(aiCategory: string): AppCategory {
  return AI_TO_APP[aiCategory] ?? "Other";
}

export function isKnownAiCategory(label: string): label is AiTransactionCategory {
  return label in AI_TO_APP;
}
