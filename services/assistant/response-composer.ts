import { format, formatDistanceToNow, parseISO } from "date-fns";

import type { AssistantContextPayload } from "@/services/assistant/context-builder";
import type { AssistantBlock, AssistantMeta } from "@/services/assistant/blocks";
import { serializeAssistantPayload } from "@/services/assistant/blocks";
import { formatInr } from "@/services/assistant/intelligence";

type Intent =
  | "login_risk"
  | "transaction_risk"
  | "fraud_score"
  | "spending_summary"
  | "food"
  | "week"
  | "yesterday"
  | "compare_months"
  | "overspend"
  | "subscriptions"
  | "save"
  | "merchants"
  | "suspicious_tx"
  | "vacation"
  | "predict"
  | "alerts"
  | "waste"
  | "finances"
  | "general";

function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  if (
    (q.includes("login") || q.includes("sign-in") || q.includes("sign in")) &&
    (q.includes("trust") || q.includes("suspicious") || q.includes("why") || q.includes("blocked"))
  ) {
    return "login_risk";
  }
  if (q.includes("trust this login") || q.includes("latest login")) return "login_risk";
  if (q.includes("subscription")) return "subscriptions";
  if (q.includes("food") || q.includes("dining") || q.includes("order")) return "food";
  if (q.includes("yesterday") || q.includes("what happened")) return "yesterday";
  if (q.includes("this week") || q.includes("week")) return "week";
  if (q.includes("compare") || q.includes("last month") || q.includes("vs last")) return "compare_months";
  if (q.includes("overspend") || q.includes("waste") || q.includes("impulse")) {
    return q.includes("waste") ? "waste" : "overspend";
  }
  if (q.includes("save") || q.includes("₹5") || q.includes("5000") || q.includes("budget")) return "save";
  if (q.includes("merchant")) return "merchants";
  if (q.includes("suspicious transaction") || q.includes("flagged") || q.includes("blocked")) {
    return q.includes("login") ? "login_risk" : "suspicious_tx";
  }
  if (q.includes("fraud score") || q.includes("causing my") || q.includes("risk score") || q.includes("explain my risk")) {
    return "fraud_score";
  }
  if (q.includes("vacation") || q.includes("afford")) return "vacation";
  if (q.includes("predict") || q.includes("month-end") || q.includes("month end")) return "predict";
  if (q.includes("alert")) return "alerts";
  if (q.includes("summarize") || q.includes("finances") || q.includes("spending")) return "spending_summary";
  if (q.includes("transaction") && (q.includes("blocked") || q.includes("why"))) return "transaction_risk";
  return "general";
}

function riskTone(tier: string | null | undefined): "neutral" | "positive" | "warning" | "critical" {
  if (tier === "CRITICAL") return "critical";
  if (tier === "HIGH") return "warning";
  if (tier === "MEDIUM") return "warning";
  if (tier === "LOW") return "positive";
  return "neutral";
}

function composeLoginRisk(ctx: AssistantContextPayload): { markdown: string; meta: AssistantMeta } {
  const focus =
    ctx.recentLogins.find((l) => l.isSuspicious || !l.trusted) ?? ctx.recentLogins[0] ?? null;
  const trustedDevice = ctx.devices.find((d) => d.trusted);
  const untrustedCount = ctx.devices.filter((d) => !d.trusted).length;
  const finHits = ctx.finEvents.filter((e) =>
    /LOGIN|FRAUD|DEVICE|CLUSTER/i.test(e.type)
  );
  const govHint = ctx.recentTransactions.some((tx) =>
    tx.factors.some((f) => f.code.startsWith("GOVERNMENT_INTELLIGENCE"))
  );

  const simple = Boolean(ctx.accessibility?.simplifiedLanguage || ctx.accessibility?.seniorMode);
  const reasons: string[] = [];
  if (focus) {
    if (!focus.trusted) {
      reasons.push(
        simple
          ? "This sign-in used a phone or place we have not confirmed as yours yet"
          : "Sign-in location or device is not marked trusted"
      );
    }
    if (focus.isSuspicious) {
      reasons.push(
        simple
          ? "This sign-in looked unusual compared with how you normally log in"
          : "Risk Engine flagged this session as suspicious"
      );
    }
    if (focus.city) reasons.push(`City observed: ${focus.city}${focus.country ? `, ${focus.country}` : ""}`);
  }
  if (untrustedCount > 0) {
    reasons.push(
      simple
        ? `${untrustedCount} phone(s) on your account are not marked as trusted`
        : `${untrustedCount} device(s) on your account are not trusted`
    );
  }
  if (finHits.length > 0) {
    reasons.push(simple ? `Related security note: ${finHits[0].title}` : `Related FIN event: ${finHits[0].title}`);
  }
  if (govHint) {
    reasons.push(
      simple
        ? "A recent payment involved a government fraud warning"
        : "A recent payment involved a government-intelligence (FRI/MNRL) signal"
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      simple ? "Your recent sign-ins look normal" : "No elevated login anomalies in the latest sessions"
    );
  }

  // Derive a display score from session signals (context may not store login score)
  let score = 28;
  if (focus?.isSuspicious) score += 30;
  if (focus && !focus.trusted) score += 18;
  if (untrustedCount > 0) score += 10;
  if (finHits.length > 0) score += 12;
  score = Math.min(99, score);
  const tier = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";

  const markdown = simple
    ? [
        `## Is this sign-in safe?`,
        ``,
        focus
          ? `I checked your latest sign-in on **${focus.label}**${
              focus.city ? ` from **${focus.city}**` : ""
            }.`
          : `I checked your recent sign-ins.`,
        ``,
        `### What we found`,
        `- Risk level: **${tier}** (${score}/100)`,
        `- Phone trust: ${focus?.trusted ? "Looks familiar" : "Not fully confirmed"}`,
        `- Unusual activity: ${focus?.isSuspicious ? "Yes" : "No"}`,
        ``,
        `### Why this matters`,
        ...reasons.map((r) => `- ${r}`),
        ``,
        `### What you should do`,
        `- Confirm that **${focus?.label ?? "this phone"}** is yours.`,
        `- Turn on an extra sign-in check in Settings if it is not already on.`,
        `- Look at recent payments for anything unexpected.`,
        `- If you do not recognize the sign-in, open the Security Map and report it.`,
      ].join("\n")
    : [
        `## Login risk assessment`,
        ``,
        focus
          ? `I reviewed your latest sign-in activity for **${focus.label}**${
              focus.city ? ` from **${focus.city}**` : ""
            }.`
          : `I reviewed your recent sign-in activity.`,
        ``,
        `### Risk summary`,
        ``,
        `| Field | Value |`,
        `| --- | --- |`,
        `| Risk level | **${tier}** |`,
        `| Risk score | **${score}/100** |`,
        `| Device trust | ${focus?.trusted ? "Trusted posture" : "Not fully trusted"} |`,
        `| Flagged suspicious | ${focus?.isSuspicious ? "Yes" : "No"} |`,
        ``,
        `### Why this matters`,
        ...reasons.map((r) => `- ${r}`),
        ``,
        `### Recommendation`,
        `- Verify whether **${focus?.label ?? "this device"}** belongs to you.`,
        `- Enable or confirm multi-factor authentication in Settings.`,
        `- Review recent transactions for unexpected activity.`,
        `- If you do not recognize the login, open Security Map and file a fraud report.`,
        ``,
        `### Related context`,
        `- Previous trusted device: **${trustedDevice?.label ?? "None marked yet"}**`,
        `- Latest observed location: **${focus?.city ?? "Unknown"}**, **${focus?.country ?? "Unknown"}**`,
        `- Open alerts: **${ctx.dashboard.openAlertCount}**`,
        ``,
        `> Persona AI combines device trust, FIN events, and your behavior profile. The rule-based Risk Engine remains authoritative — this explanation helps you act with clarity.`,
      ].join("\n");

  const blocks: AssistantBlock[] = [
    {
      type: "risk-summary",
      title: "Login risk",
      score,
      tier,
      reasons,
      recommendation:
        "Verify the device, enable MFA, review recent transactions, and report the login if unrecognized.",
      explanation: focus
        ? `${focus.label} · ${focus.city ?? "Unknown city"} · ${formatDistanceToNow(parseISO(focus.occurredAt), { addSuffix: true })}`
        : null,
    },
    {
      type: "timeline",
      title: "Recent login timeline",
      events: ctx.recentLogins.slice(0, 5).map((login) => ({
        label: login.label,
        detail: `${login.city ?? "Unknown city"} · ${format(parseISO(login.occurredAt), "dd MMM, h:mm a")}${
          login.isSuspicious ? " · suspicious" : ""
        }`,
        tone: login.isSuspicious || !login.trusted ? "warning" : "positive",
      })),
    },
    {
      type: "action-row",
      actions: [
        { label: "Open Security Map", href: "/security/login-history", variant: "default" },
        { label: "View devices", href: "/security/devices", variant: "outline" },
        { label: "Explain device fingerprint", prompt: "Explain the device fingerprint on my latest login", variant: "secondary" },
        { label: "Report this login", prompt: "How do I report a suspicious login?", variant: "outline" },
      ],
    },
  ];

  return {
    markdown,
    meta: {
      blocks,
      followUps: [
        "Explain the device fingerprint",
        "Show my login timeline",
        "Open Security Map",
        "Show unusual expenses after this login",
        "Should I trust my latest login?",
      ],
    },
  };
}

function composeTransactionRisk(ctx: AssistantContextPayload): { markdown: string; meta: AssistantMeta } {
  const risky =
    ctx.recentTransactions.find(
      (tx) =>
        tx.riskTier === "HIGH" ||
        tx.riskTier === "CRITICAL" ||
        tx.status === "PENDING" ||
        tx.status === "DENIED" ||
        tx.status === "FLAGGED"
    ) ?? ctx.recentTransactions.find((tx) => (tx.riskScore ?? 0) >= 40);

  if (!risky) {
    return {
      markdown: [
        `## Transaction risk`,
        ``,
        `I do not see a blocked or high-risk payment in your recent activity.`,
        ``,
        `Your account security status is **${ctx.dashboard.securityStatus}** with **${ctx.dashboard.openAlertCount}** open alert(s).`,
        ``,
        `If a specific payment was declined, open **Transactions** and select it — I can explain the Risk Engine factors once it appears in context.`,
      ].join("\n"),
      meta: {
        blocks: [
          {
            type: "action-row",
            actions: [
              { label: "View transactions", href: "/transactions" },
              { label: "Review alerts", href: "/alerts", variant: "outline" },
              { label: "Summarize today's activity", prompt: "Summarize today's activity", variant: "secondary" },
            ],
          },
        ],
        followUps: ["Show suspicious transactions", "Explain my fraud score", "Summarize my finances"],
      },
    };
  }

  const reasons = risky.factors.map((f) => `${f.label}: ${f.detail}`);
  const markdown = [
    `## Why this payment raised risk`,
    ``,
    `### ${risky.merchant}`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Amount | **${formatInr(risky.amount)}** |`,
    `| Category | ${risky.category} |`,
    `| Status | **${risky.status}** |`,
    `| Risk score | **${risky.riskScore ?? "n/a"}/100** |`,
    `| Risk tier | **${risky.riskTier ?? "n/a"}** |`,
    risky.aiRiskScore ? `| Transaction AI contribution | **${risky.aiRiskScore}** pts (additive) |` : null,
    ``,
    `### Triggered factors`,
    ...(reasons.length ? reasons.map((r) => `- ${r}`) : ["- No factor detail stored for this assessment"]),
    ``,
    `### AI explanation`,
    risky.explanation ?? "No stored explanation for this assessment.",
    ``,
    `### Recommended action`,
    risky.recommendation ?? "Review the payment in High-Risk Verification if it is still pending.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    markdown,
    meta: {
      blocks: [
        {
          type: "risk-summary",
          title: risky.merchant,
          score: risky.riskScore,
          tier: risky.riskTier,
          reasons: reasons.slice(0, 8),
          recommendation: risky.recommendation ?? "Complete step-up verification or cancel if unrecognized.",
          explanation: risky.explanation,
        },
        {
          type: "action-row",
          actions: [
            { label: "View transaction", href: `/transactions/${risky.id}` },
            { label: "Open alerts", href: "/alerts", variant: "outline" },
            { label: "Explain further", prompt: "Explain my fraud score in more detail", variant: "secondary" },
          ],
        },
      ],
      followUps: [
        "Show suspicious transactions",
        "What is causing my fraud score?",
        "Should I trust my latest login?",
        "Review recent alerts",
      ],
    },
  };
}

function composeSpending(ctx: AssistantContextPayload, intent: Intent): { markdown: string; meta: AssistantMeta } {
  const intel = ctx.intelligence;
  const title =
    intent === "food"
      ? "Food & dining spend"
      : intent === "week"
        ? "This week’s spending"
        : intent === "yesterday"
          ? "Yesterday’s activity"
          : intent === "compare_months"
            ? "Month-over-month comparison"
            : "Spending summary";

  const lines = [`## ${title}`, ``];

  if (intent === "food") {
    lines.push(
      `You spent **${formatInr(intel.foodSpendThisMonth)}** on food/dining this month, including **${formatInr(intel.foodSpendThisWeek)}** this week.`,
      ``,
      `That is **${
        intel.monthlySpend > 0 ? Math.round((intel.foodSpendThisMonth / intel.monthlySpend) * 100) : 0
      }%** of your month-to-date spending.`
    );
  } else if (intent === "week") {
    lines.push(`Week-to-date spending: **${formatInr(intel.weekSpend)}**.`);
  } else if (intent === "yesterday") {
    lines.push(
      `Yesterday you spent **${formatInr(intel.yesterdaySpend)}**.`,
      ``,
      `Recent activity highlights:`
    );
    for (const tx of ctx.recentTransactions.slice(0, 5)) {
      lines.push(
        `- ${format(parseISO(tx.date), "h:mm a")} · ${tx.merchant} · ${formatInr(tx.amount)}${
          tx.riskTier && tx.riskTier !== "LOW" ? ` · ${tx.riskTier}` : ""
        }`
      );
    }
  } else if (intent === "compare_months") {
    const delta = intel.previousMonthSpend
      ? ((intel.monthlySpend - intel.previousMonthSpend) / intel.previousMonthSpend) * 100
      : null;
    lines.push(
      `| Period | Spend |`,
      `| --- | --- |`,
      `| This month (MTD) | **${formatInr(intel.monthlySpend)}** |`,
      `| Last month | **${formatInr(intel.previousMonthSpend)}** |`,
      `| Change | **${delta === null ? "n/a" : `${delta > 0 ? "+" : ""}${Math.round(delta)}%`}** |`,
      ``,
      `### Category movements`
    );
    for (const trend of intel.categoryTrends.slice(0, 5)) {
      const deltaLabel =
        trend.deltaPct === null ? "new" : `${trend.deltaPct > 0 ? "+" : ""}${Math.round(trend.deltaPct)}%`;
      lines.push(
        `- **${trend.category}**: ${formatInr(trend.thisMonth)} vs ${formatInr(trend.lastMonth)} (${deltaLabel})`
      );
    }
  } else {
    lines.push(
      `Here is a clear view of your finances grounded in your ledger:`,
      ``,
      `| Metric | Value |`,
      `| --- | --- |`,
      `| Balance | **${formatInr(intel.balance)}** |`,
      `| This month spend | **${formatInr(intel.monthlySpend)}** |`,
      `| Last month | **${formatInr(intel.previousMonthSpend)}** |`,
      `| Income (MTD) | **${formatInr(intel.incomeThisMonth)}** |`,
      `| Cash flow | **${formatInr(intel.cashFlow)}** |`,
      `| Predicted month-end | **${formatInr(intel.predictedMonthEndSpend)}** |`
    );
  }

  const blocks: AssistantBlock[] = [
    {
      type: "stat-grid",
      title: "Key figures",
      stats: [
        { label: "Balance", value: formatInr(intel.balance), tone: "neutral" },
        {
          label: "This month",
          value: formatInr(intel.monthlySpend),
          tone: intel.monthlySpend > intel.previousMonthSpend ? "warning" : "positive",
        },
        { label: "This week", value: formatInr(intel.weekSpend) },
        {
          label: "Cash flow",
          value: formatInr(intel.cashFlow),
          tone: intel.cashFlow >= 0 ? "positive" : "warning",
        },
      ],
    },
  ];

  if (ctx.spending.categoryBreakdown.length > 0) {
    blocks.push({
      type: "category-chart",
      title: "Top categories",
      data: ctx.spending.categoryBreakdown,
    });
  }
  if (ctx.spending.monthlyTrend.length > 0) {
    blocks.push({
      type: "trend-chart",
      title: "Monthly trend",
      data: ctx.spending.monthlyTrend,
    });
  }
  blocks.push({
    type: "action-row",
    actions: [
      { label: "View transactions", href: "/transactions" },
      { label: "Show subscriptions", prompt: "Which subscriptions are expensive?" },
      { label: "How can I save?", prompt: "How can I save ₹5,000 this month?", variant: "secondary" },
    ],
  });

  return {
    markdown: lines.join("\n"),
    meta: {
      blocks,
      followUps: [
        "Where am I overspending?",
        "Which subscriptions are expensive?",
        "Compare this month with last month",
        "Predict month-end spending",
        "Show biggest expenses",
      ],
    },
  };
}

function composeSave(ctx: AssistantContextPayload): { markdown: string; meta: AssistantMeta } {
  const intel = ctx.intelligence;
  const tips: string[] = [];
  if (intel.unusedSubscriptions.length) {
    tips.push(
      `Cancel unused subscriptions: ${intel.unusedSubscriptions.map((s) => s.merchant).join(", ")} (~${formatInr(
        intel.unusedSubscriptions.reduce((s, x) => s + x.monthlyAmount, 0)
      )}/mo)`
    );
  }
  if (intel.foodSpendThisMonth > 0) {
    tips.push(`Trim food/dining by 20% to free about ${formatInr(intel.foodSpendThisMonth * 0.2)}`);
  }
  if (intel.impulseSpendEstimate > 0) {
    tips.push(`Reduce evening impulse purchases (~${formatInr(intel.impulseSpendEstimate)} MTD)`);
  }
  if (intel.weekendSpend > intel.monthlySpend * 0.35) {
    tips.push(`Weekend spending is elevated at ${formatInr(intel.weekendSpend)} — set a weekend cap`);
  }
  if (tips.length === 0) {
    tips.push("Your spending looks relatively stable — keep category budgets for Dining and Shopping.");
  }

  const opportunity = Math.round(
    intel.unusedSubscriptions.reduce((s, x) => s + x.monthlyAmount, 0) +
      intel.foodSpendThisMonth * 0.15 +
      intel.impulseSpendEstimate * 0.4
  );

  const markdown = [
    `## Savings plan`,
    ``,
    `Based on your real ledger, you could realistically free about **${formatInr(
      Math.max(opportunity, 500)
    )}** this month without cutting essentials.`,
    ``,
    `### Opportunities`,
    ...tips.map((t) => `- ${t}`),
    ``,
    `### Projected position`,
    `- Predicted month-end spend: **${formatInr(intel.predictedMonthEndSpend)}**`,
    `- Projected savings if income holds: **${formatInr(intel.projectedSavings)}**`,
  ].join("\n");

  return {
    markdown,
    meta: {
      blocks: [
        {
          type: "savings-card",
          title: "Save opportunity",
          amount: formatInr(Math.max(opportunity, 500)),
          detail: "Estimated from unused subscriptions, food trim, and impulse patterns.",
          tips,
        },
        {
          type: "merchant-list",
          title: "Subscription review",
          merchants: intel.subscriptions.slice(0, 5).map((s) => ({
            merchant: s.merchant,
            amount: formatInr(s.monthlyAmount),
            count: s.occurrences,
          })),
        },
        {
          type: "action-row",
          actions: [
            { label: "Show subscriptions", prompt: "Which subscriptions are expensive?" },
            { label: "Show biggest expenses", prompt: "Show my largest purchases this month" },
            { label: "Food spending", prompt: "How much food did I order?", variant: "secondary" },
          ],
        },
      ],
      followUps: [
        "Show subscriptions",
        "Show biggest expenses",
        "Where am I overspending?",
        "Compare this month with last month",
      ],
    },
  };
}

function composeSubscriptions(ctx: AssistantContextPayload): { markdown: string; meta: AssistantMeta } {
  const subs = ctx.intelligence.subscriptions;
  if (subs.length === 0) {
    return {
      markdown: `## Subscriptions\n\nI do not detect clear recurring subscriptions in the last 90 days yet.`,
      meta: {
        blocks: [],
        followUps: ["Analyze my spending", "Show unusual expenses", "Summarize my finances"],
      },
    };
  }
  const total = subs.reduce((s, x) => s + x.monthlyAmount, 0);
  const markdown = [
    `## Subscription detection`,
    ``,
    `I found **${subs.length}** recurring payments totaling about **${formatInr(total)}/month**.`,
    ``,
    `| Merchant | Est. monthly | Hits (90d) |`,
    `| --- | --- | --- |`,
    ...subs.map((s) => `| ${s.merchant} | ${formatInr(s.monthlyAmount)} | ${s.occurrences} |`),
    ``,
    ctx.intelligence.unusedSubscriptions.length
      ? `**Possibly unused:** ${ctx.intelligence.unusedSubscriptions.map((s) => s.merchant).join(", ")}`
      : `No clearly unused subscriptions this month.`,
  ].join("\n");

  return {
    markdown,
    meta: {
      blocks: [
        {
          type: "merchant-list",
          title: "Recurring payments",
          merchants: subs.map((s) => ({
            merchant: s.merchant,
            amount: formatInr(s.monthlyAmount),
            count: s.occurrences,
          })),
        },
        {
          type: "action-row",
          actions: [
            { label: "How can I save?", prompt: "How can I save ₹5,000 this month?" },
            { label: "View transactions", href: "/transactions", variant: "outline" },
          ],
        },
      ],
      followUps: ["How can I save ₹5,000 this month?", "Show unusual expenses", "Compare this month with last month"],
    },
  };
}

function composeFraudScore(ctx: AssistantContextPayload): { markdown: string; meta: AssistantMeta } {
  const scored = [...ctx.recentTransactions]
    .filter((tx) => tx.riskScore !== null)
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  const top = scored[0];
  const factorCounts = new Map<string, number>();
  for (const tx of scored) {
    for (const f of tx.factors) {
      factorCounts.set(f.label, (factorCounts.get(f.label) ?? 0) + 1);
    }
  }
  const topFactors = Array.from(factorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const markdown = [
    `## What is driving your fraud / risk score`,
    ``,
    top
      ? `Your highest recent assessment is **${top.riskScore}/100 (${top.riskTier})** on **${top.merchant}**.`
      : `I do not have a scored transaction yet. Simulate a payment or wait for the next Risk Engine assessment.`,
    ``,
    `### Most common risk factors`,
    ...(topFactors.length
      ? topFactors.map(([label, count]) => `- **${label}** — appeared in ${count} recent assessment(s)`)
      : ["- No stored factors yet"]),
    ``,
    `Security status: **${ctx.dashboard.securityStatus}** · Open alerts: **${ctx.dashboard.openAlertCount}**`,
  ].join("\n");

  return {
    markdown,
    meta: {
      blocks: [
        top
          ? {
              type: "risk-summary",
              title: "Highest recent risk",
              score: top.riskScore,
              tier: top.riskTier,
              reasons: top.factors.map((f) => f.detail).slice(0, 6),
              recommendation: top.recommendation ?? "Review the payment and complete verification if prompted.",
              explanation: top.explanation,
            }
          : {
              type: "alert-callout",
              severity: "info",
              title: "No scored payments yet",
              body: "Once the Risk Engine scores a payment, I will break down every contributing factor here.",
            },
        {
          type: "transaction-table",
          title: "Recent risk-scored payments",
          rows: scored.slice(0, 6).map((tx) => ({
            id: tx.id,
            merchant: tx.merchant,
            amount: formatInr(tx.amount),
            category: tx.category,
            date: format(parseISO(tx.date), "dd MMM"),
            riskTier: tx.riskTier,
          })),
        },
        {
          type: "action-row",
          actions: [
            { label: "Review alerts", href: "/alerts" },
            { label: "Suspicious transactions", prompt: "Show me suspicious transactions", variant: "secondary" },
          ],
        },
      ],
      followUps: [
        "Show me suspicious transactions",
        "Why was my transaction blocked?",
        "Should I trust my latest login?",
        "Review recent alerts",
      ],
    },
  };
}

function composeGeneral(ctx: AssistantContextPayload): { markdown: string; meta: AssistantMeta } {
  return {
    markdown: [
      `## Hello ${ctx.customer.firstName}`,
      ``,
      `I’m **Persona AI** — your calm, security-focused financial copilot. I only reason from your Persona AI data: Risk Engine, FIN, devices, behavior, and Transaction Intelligence.`,
      ``,
      `| Snapshot | |`,
      `| --- | --- |`,
      `| Balance | **${formatInr(ctx.intelligence.balance)}** |`,
      `| Spend MTD | **${formatInr(ctx.intelligence.monthlySpend)}** |`,
      `| Security | **${ctx.dashboard.securityStatus}** |`,
      `| Open alerts | **${ctx.dashboard.openAlertCount}** |`,
      ``,
      ctx.insights[0] ? `**Insight:** ${ctx.insights[0].title}` : `Ask me about risk, spending, or savings whenever you are ready.`,
    ].join("\n"),
    meta: {
      blocks: [
        {
          type: "stat-grid",
          title: "At a glance",
          stats: [
            { label: "Balance", value: formatInr(ctx.intelligence.balance) },
            { label: "Monthly spend", value: formatInr(ctx.intelligence.monthlySpend) },
            {
              label: "Fraud posture",
              value: ctx.dashboard.securityStatus,
              tone: riskTone(
                ctx.recentTransactions.find((t) => t.riskTier)?.riskTier ?? "LOW"
              ),
            },
            { label: "Open alerts", value: String(ctx.dashboard.openAlertCount), tone: ctx.dashboard.openAlertCount > 0 ? "warning" : "positive" },
          ],
        },
        {
          type: "action-row",
          actions: [
            { label: "Explain my fraud score", prompt: "Explain my fraud score" },
            { label: "Analyze spending", prompt: "Analyze my spending" },
            { label: "Latest login", prompt: "Should I trust my latest login?", variant: "secondary" },
          ],
        },
      ],
      followUps: [
        "Should I trust my latest login?",
        "Summarize my finances",
        "How can I save ₹5,000 this month?",
        "Show me suspicious transactions",
      ],
    },
  };
}

/**
 * Builds a rich, structured, context-grounded assistant reply.
 */
export function composeAssistantResponse(
  question: string,
  context: AssistantContextPayload
): string {
  const intent = detectIntent(question);
  let result: { markdown: string; meta: AssistantMeta };

  switch (intent) {
    case "login_risk":
      result = composeLoginRisk(context);
      break;
    case "transaction_risk":
    case "suspicious_tx":
      result = intent === "suspicious_tx"
        ? composeFraudScore(context)
        : composeTransactionRisk(context);
      break;
    case "fraud_score":
      result = composeFraudScore(context);
      break;
    case "subscriptions":
      result = composeSubscriptions(context);
      break;
    case "save":
    case "waste":
    case "overspend":
      result = composeSave(context);
      break;
    case "food":
    case "week":
    case "yesterday":
    case "compare_months":
    case "spending_summary":
    case "finances":
    case "merchants":
    case "predict":
    case "vacation":
    case "alerts":
      if (intent === "merchants") {
        const intel = context.intelligence;
        result = {
          markdown: [
            `## Top merchants`,
            ``,
            ...intel.topMerchants.map(
              (m, i) => `${i + 1}. **${m.merchant}** — ${formatInr(m.amount)} (${m.count} visits)`
            ),
          ].join("\n"),
          meta: {
            blocks: [
              {
                type: "merchant-list",
                title: "Most visited merchants",
                merchants: intel.topMerchants.map((m) => ({
                  merchant: m.merchant,
                  amount: formatInr(m.amount),
                  count: m.count,
                })),
              },
            ],
            followUps: ["Where am I overspending?", "How much food did I order?", "Find subscriptions"],
          },
        };
      } else if (intent === "predict") {
        const intel = context.intelligence;
        result = {
          markdown: [
            `## Month-end forecast`,
            ``,
            `At your current pace you are projected to spend **${formatInr(intel.predictedMonthEndSpend)}** by month-end.`,
            ``,
            `- Spent so far: **${formatInr(intel.monthlySpend)}**`,
            `- Last month actual: **${formatInr(intel.previousMonthSpend)}**`,
            `- Projected savings (if income holds): **${formatInr(intel.projectedSavings)}**`,
          ].join("\n"),
          meta: {
            blocks: [
              {
                type: "stat-grid",
                title: "Forecast",
                stats: [
                  { label: "Predicted spend", value: formatInr(intel.predictedMonthEndSpend), tone: "warning" },
                  { label: "MTD spend", value: formatInr(intel.monthlySpend) },
                  { label: "Projected savings", value: formatInr(intel.projectedSavings), tone: "positive" },
                ],
              },
              {
                type: "trend-chart",
                title: "Trend",
                data: context.spending.monthlyTrend,
              },
            ],
            followUps: ["How can I save ₹5,000 this month?", "Compare this month with last month"],
          },
        };
      } else if (intent === "vacation") {
        const intel = context.intelligence;
        const buffer = intel.balance - intel.predictedMonthEndSpend * 0.35;
        const affordable = buffer > 25000;
        result = {
          markdown: [
            `## Can you afford a vacation?`,
            ``,
            affordable
              ? `Based on your **${formatInr(intel.balance)}** balance and predicted month-end spend of **${formatInr(intel.predictedMonthEndSpend)}**, a modest trip looks **feasible** if you keep discretionary spend flat.`
              : `With **${formatInr(intel.balance)}** on hand and **${formatInr(intel.predictedMonthEndSpend)}** predicted spend, a vacation may **strain cash flow** unless you pause non-essential categories.`,
            ``,
            `Suggested buffer after essentials: **${formatInr(Math.max(buffer, 0))}**.`,
          ].join("\n"),
          meta: {
            blocks: [
              {
                type: "alert-callout",
                severity: affordable ? "info" : "warning",
                title: affordable ? "Feasible with discipline" : "Tight cash-flow risk",
                body: "This is guidance from your ledger — not a credit decision.",
              },
            ],
            followUps: ["How can I save ₹5,000 this month?", "Predict month-end spending", "Where am I overspending?"],
          },
        };
      } else if (intent === "alerts") {
        result = {
          markdown: [
            `## Recent alerts`,
            ``,
            ...(context.alerts.length
              ? context.alerts.slice(0, 6).map(
                  (a) => `- **${a.severity}** · ${a.title} — ${a.body}`
                )
              : ["No open alerts in context."]),
          ].join("\n"),
          meta: {
            blocks: [
              {
                type: "action-row",
                actions: [
                  { label: "Open alerts", href: "/alerts" },
                  { label: "Explain my fraud score", prompt: "Explain my fraud score", variant: "secondary" },
                ],
              },
            ],
            followUps: ["Explain my fraud score", "Show me suspicious transactions"],
          },
        };
      } else {
        result = composeSpending(context, intent);
      }
      break;
    default:
      result = composeGeneral(context);
  }

  return serializeAssistantPayload(result.markdown, result.meta);
}
