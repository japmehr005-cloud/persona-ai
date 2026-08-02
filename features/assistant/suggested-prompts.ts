/** Stable prompt IDs — labels/prompts resolved via i18n at render time. */
export const ASSISTANT_PROMPT_IDS = [
  "fraudScore",
  "todayActivity",
  "analyzeSpending",
  "findSubscriptions",
  "unusualExpenses",
  "trustLogin",
  "compareMonth",
  "predictMonthEnd",
  "save5000",
  "reviewAlerts",
  "analyzeCategories",
  "suspiciousTx",
] as const;

export type AssistantPromptId = (typeof ASSISTANT_PROMPT_IDS)[number];

export const MOBILE_CHIP_IDS = [
  { id: "fraudRisk" as const, promptId: "fraudScore" as const },
  { id: "spending" as const, promptId: "analyzeSpending" as const },
  { id: "budget" as const, promptId: "compareThisMonth" as const },
  { id: "savings" as const, promptId: "save5000" as const },
  { id: "subscriptions" as const, promptId: "expensiveSubscriptions" as const },
  { id: "security" as const, promptId: "reviewAlerts" as const },
  { id: "recentLogin" as const, promptId: "trustLogin" as const },
  { id: "unusual" as const, promptId: "unusualExpenses" as const },
];

/** @deprecated Prefer ASSISTANT_PROMPT_IDS + useTranslations("assistant.prompts") */
export const ASSISTANT_QUICK_ACTIONS = [
  "Explain my fraud score",
  "Summarize today's activity",
  "Analyze my spending",
  "Find subscriptions",
  "Show unusual expenses",
  "Should I trust my latest login?",
  "Compare last month",
  "Predict month-end spending",
  "How can I save ₹5,000 this month?",
  "Review recent alerts",
  "Analyze transaction categories",
  "Show me suspicious transactions",
] as const;

export const ASSISTANT_SUGGESTED_PROMPTS = ASSISTANT_QUICK_ACTIONS;

/** @deprecated Prefer MOBILE_CHIP_IDS + useTranslations */
export const MOBILE_QUICK_CHIPS = [
  { label: "Fraud Risk", prompt: "Explain my fraud score" },
  { label: "Spending", prompt: "Analyze my spending" },
  { label: "Budget", prompt: "Compare this month with last month" },
  { label: "Savings", prompt: "How can I save ₹5,000 this month?" },
  { label: "Subscriptions", prompt: "Which subscriptions are expensive?" },
  { label: "Security", prompt: "Review recent alerts" },
  { label: "Recent Login", prompt: "Should I trust my latest login?" },
  { label: "Unusual", prompt: "Show unusual expenses" },
] as const;
