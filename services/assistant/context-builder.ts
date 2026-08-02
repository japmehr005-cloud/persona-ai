import { prisma } from "@/lib/prisma";
import { getDashboardSummary } from "@/services/dashboard/get-dashboard-summary";
import { getSpendingInsights } from "@/services/dashboard/get-spending-insights";
import { getBehavioralProfileView } from "@/services/behavior-engine/get-behavioral-profile-view";
import { getDevicesAndSessions } from "@/services/security/get-devices-and-sessions";
import { getLoginTimeline } from "@/services/fin/device-intelligence";
import { getUserAlerts } from "@/services/alerts/get-user-alerts";
import { getFraudReportsForUser } from "@/services/fin/fraud-report-service";
import { getFinEventsForUser } from "@/services/fin/fin-event-logger";
import { classifyTransactionNarration } from "@/services/transaction-ai/client";
import {
  buildFinancialInsights,
  type FinancialInsight,
} from "@/services/assistant/financial-insights";
import {
  buildFinancialIntelligence,
  type FinancialIntelligence,
} from "@/services/assistant/intelligence";

export interface AssistantContextPayload {
  generatedAt: string;
  customer: { firstName: string; lastName: string; email: string };
  dashboard: {
    totalBalance: number;
    monthlySpending: number;
    previousMonthSpending: number;
    securityStatus: string;
    openAlertCount: number;
  };
  spending: {
    monthlyTrend: { month: string; amount: number }[];
    categoryBreakdown: { category: string; amount: number }[];
  };
  insights: FinancialInsight[];
  intelligence: FinancialIntelligence;
  recentTransactions: Array<{
    id: string;
    date: string;
    merchant: string;
    category: string;
    amount: number;
    status: string;
    riskTier: string | null;
    riskScore: number | null;
    explanation: string | null;
    recommendation: string | null;
    aiRiskScore: number | null;
    factors: Array<{ code: string; label: string; detail: string; contribution: number }>;
  }>;
  behavior: {
    hasProfile: boolean;
    sampleSize: number;
    avgAmount: number | null;
    topMerchants: string[];
    categoryFrequency: Record<string, number> | null;
  };
  devices: Array<{ label: string; trusted: boolean; lastSeenAt: string }>;
  recentLogins: Array<{
    occurredAt: string;
    label: string;
    city: string | null;
    country: string | null;
    trusted: boolean;
    isSuspicious: boolean;
  }>;
  alerts: Array<{ id: string; title: string; severity: string; body: string; createdAt: string }>;
  fraudReports: Array<{ id: string; type: string; status: string; beneficiary: string | null }>;
  finEvents: Array<{ type: string; title: string; createdAt: string }>;
  transactionAiSample: Array<{
    merchant: string;
    category: string | null;
    confidence: number | null;
  }>;
  currentFraudRisk: {
    score: number | null;
    tier: string | null;
    label: string;
  };
}

export const ASSISTANT_SYSTEM_PROMPT = `You are Persona AI — the flagship financial intelligence copilot for a secure banking platform.

Identity:
- Professional, calm, helpful, security-focused financial advisor
- Speak in clear banking terminology (risk tier, step-up verification, device trust, FIN, FRI/MNRL)
- Never sound robotic or like a generic chatbot

Rules:
- Answer ONLY using the structured customer context JSON provided
- Never invent balances, merchants, risk scores, or government hits
- If context lacks an answer, say so and point to Security Map, Transactions, or Alerts
- Prefer rich structured markdown: headings, tables, bullet lists — never a single short paragraph
- Always include a Recommendation section for security questions
- Currency is Indian Rupees (₹)
- End with 3–5 contextual follow-up questions the customer might ask next
- When useful, append a meta trailer exactly in this format after the markdown:

%%PERSONA_META%%
{"blocks":[],"followUps":["..."]}

Block types allowed in meta.blocks: risk-summary, stat-grid, transaction-table, category-chart, trend-chart, merchant-list, timeline, action-row, alert-callout, savings-card.
Keep JSON valid and compact.`;

export async function buildAssistantContext(userId: string): Promise<AssistantContextPayload> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });

  const [
    dashboard,
    spending,
    insights,
    intelligence,
    behaviorView,
    deviceBundle,
    loginTimeline,
    alerts,
    fraudReports,
    finEvents,
    recentTx,
    profile,
  ] = await Promise.all([
    getDashboardSummary(userId),
    getSpendingInsights(userId),
    buildFinancialInsights(userId),
    buildFinancialIntelligence(userId),
    getBehavioralProfileView(userId),
    getDevicesAndSessions(userId),
    getLoginTimeline(userId),
    getUserAlerts(userId),
    getFraudReportsForUser(userId),
    getFinEventsForUser(userId, 20),
    prisma.transaction.findMany({
      where: { account: { userId } },
      orderBy: { date: "desc" },
      take: 20,
      include: {
        riskAssessment: {
          include: {
            factors: {
              orderBy: { contribution: "desc" },
              take: 8,
            },
          },
        },
      },
    }),
    prisma.behavioralProfile.findUnique({ where: { userId } }),
  ]);

  const merchantsForAi = Array.from(new Set(recentTx.map((tx) => tx.merchant))).slice(0, 5);
  const transactionAiSample = await Promise.all(
    merchantsForAi.map(async (merchant) => {
      const ai = await classifyTransactionNarration(merchant);
      return {
        merchant,
        category: ai?.category ?? null,
        confidence: ai?.confidence ?? null,
      };
    })
  );

  const categoryFrequency =
    profile?.categoryFrequency &&
    typeof profile.categoryFrequency === "object" &&
    !Array.isArray(profile.categoryFrequency)
      ? (profile.categoryFrequency as Record<string, number>)
      : null;

  const topRisk = [...recentTx]
    .map((tx) => tx.riskAssessment)
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))[0];

  return {
    generatedAt: new Date().toISOString(),
    customer: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    dashboard: {
      totalBalance: dashboard.totalBalance,
      monthlySpending: dashboard.monthlySpending,
      previousMonthSpending: dashboard.previousMonthSpending,
      securityStatus: dashboard.securityStatus,
      openAlertCount: dashboard.openAlerts.length,
    },
    spending: {
      monthlyTrend: spending.monthlyTrend,
      categoryBreakdown: spending.categoryBreakdown,
    },
    insights,
    intelligence,
    recentTransactions: recentTx.map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      merchant: tx.merchant,
      category: tx.category,
      amount: Number(tx.amount),
      status: tx.status,
      riskTier: tx.riskAssessment?.tier ?? null,
      riskScore: tx.riskAssessment?.score ?? null,
      explanation: tx.riskAssessment?.explanation ?? null,
      recommendation: tx.riskAssessment?.recommendation ?? null,
      aiRiskScore: tx.riskAssessment?.aiRiskScore ?? null,
      factors:
        tx.riskAssessment?.factors.map((f) => ({
          code: f.code,
          label: f.label,
          detail: f.detail,
          contribution: f.contribution,
        })) ?? [],
    })),
    behavior: {
      hasProfile: behaviorView.hasProfile,
      sampleSize: behaviorView.sampleSize,
      avgAmount: behaviorView.hasProfile ? behaviorView.avgAmount : null,
      topMerchants: behaviorView.topMerchants.slice(0, 6).map((m) => m.merchant),
      categoryFrequency,
    },
    devices: deviceBundle.devices.slice(0, 10).map((d) => ({
      label: d.label,
      trusted: d.trusted,
      lastSeenAt: d.lastSeenAt.toISOString(),
    })),
    recentLogins: loginTimeline.slice(0, 12).map((entry) => ({
      occurredAt: entry.occurredAt.toISOString(),
      label: entry.label,
      city: entry.city,
      country: entry.country,
      trusted: entry.trusted,
      isSuspicious: entry.isSuspicious,
    })),
    alerts: alerts.slice(0, 10).map((alert) => ({
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      body: alert.body,
      createdAt: alert.createdAt.toISOString(),
    })),
    fraudReports: fraudReports.slice(0, 8).map((report) => ({
      id: report.id,
      type: report.type,
      status: report.status,
      beneficiary: report.beneficiary,
    })),
    finEvents: finEvents.slice(0, 12).map((event) => ({
      type: event.type,
      title: event.summary,
      createdAt: event.createdAt.toISOString(),
    })),
    transactionAiSample,
    currentFraudRisk: {
      score: topRisk?.score ?? null,
      tier: topRisk?.tier ?? null,
      label: topRisk ? `${topRisk.tier} · ${topRisk.score}/100` : dashboard.securityStatus,
    },
  };
}
