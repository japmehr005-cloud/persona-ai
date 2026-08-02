"use server";

import { requireUser } from "@/lib/session";
import { buildAssistantContext } from "@/services/assistant/context-builder";
import { buildFinancialInsights } from "@/services/assistant/financial-insights";
import {
  createAssistantThread,
  getAssistantThread,
  getOrCreateAssistantThread,
  listAssistantThreads,
} from "@/services/assistant/thread-service";

export async function getAssistantBootstrapAction() {
  const user = await requireUser();
  const [thread, threads, insights, context] = await Promise.all([
    getOrCreateAssistantThread(user.id),
    listAssistantThreads(user.id),
    buildFinancialInsights(user.id),
    buildAssistantContext(user.id),
  ]);
  return {
    thread,
    threads,
    insights,
    intel: {
      balance: context.intelligence.balance,
      monthlySpend: context.intelligence.monthlySpend,
      previousMonthSpend: context.intelligence.previousMonthSpend,
      weekSpend: context.intelligence.weekSpend,
      currentFraudRisk: context.currentFraudRisk,
      categoryBreakdown: context.spending.categoryBreakdown,
      topMerchants: context.intelligence.topMerchants,
      openAlerts: context.alerts.slice(0, 4),
      devices: context.devices,
      recentLogin: context.recentLogins[0] ?? null,
      subscriptions: context.intelligence.subscriptions.slice(0, 4),
      savingsOpportunity: context.insights.find((i) => i.id === "save-estimate") ?? null,
      monthlyTrend: context.spending.monthlyTrend,
      securityStatus: context.dashboard.securityStatus,
      pinnedInsights: insights.slice(0, 4),
    },
  };
}

export async function createAssistantThreadAction() {
  const user = await requireUser();
  const thread = await createAssistantThread(user.id);
  const threads = await listAssistantThreads(user.id);
  return { thread, threads };
}

export async function loadAssistantThreadAction(threadId: string) {
  const user = await requireUser();
  const thread = await getAssistantThread(user.id, threadId);
  if (!thread) throw new Error("Conversation not found");
  return thread;
}
