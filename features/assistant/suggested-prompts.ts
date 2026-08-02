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

/** Short chip labels for mobile horizontal scroller */
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
