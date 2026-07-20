import { prisma } from "@/lib/prisma";

export interface SystemAlertRow {
  id: string;
  title: string;
  body: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  disposition: "UNREVIEWED" | "CONFIRMED_FRAUD" | "FALSE_POSITIVE" | "ESCALATED";
  analystNote: string | null;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  transactionId: string | null;
  transactionMerchant: string | null;
  transactionAmount: number | null;
}

const SYSTEM_ALERTS_LIMIT = 200;

export async function getSystemAlerts(): Promise<SystemAlertRow[]> {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: SYSTEM_ALERTS_LIMIT,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      transaction: { select: { id: true, merchant: true, amount: true } },
    },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    title: alert.title,
    body: alert.body,
    severity: alert.severity,
    status: alert.status,
    disposition: alert.disposition,
    analystNote: alert.analystNote,
    createdAt: alert.createdAt,
    customerName: `${alert.user.firstName} ${alert.user.lastName}`,
    customerEmail: alert.user.email,
    transactionId: alert.transaction?.id ?? null,
    transactionMerchant: alert.transaction?.merchant ?? null,
    transactionAmount: alert.transaction ? Number(alert.transaction.amount) : null,
  }));
}
