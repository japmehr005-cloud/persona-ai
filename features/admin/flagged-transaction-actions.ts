"use server";

import { revalidatePath } from "next/cache";

import { requireAnalyst } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/services/audit/audit-logger";

async function resolveFlaggedTransaction(transactionId: string, status: "APPROVED" | "DENIED") {
  const analyst = await requireAnalyst();

  await prisma.$transaction([
    prisma.transaction.update({ where: { id: transactionId }, data: { status } }),
    prisma.alert.updateMany({
      where: { transactionId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    }),
    prisma.otpChallenge.updateMany({
      where: { transactionId, status: "PENDING" },
      data: { status: "EXPIRED" },
    }),
  ]);

  await logAuditEvent({
    userId: analyst.id,
    action: status === "APPROVED" ? "ANALYST_APPROVED_TRANSACTION" : "ANALYST_DENIED_TRANSACTION",
    entityType: "Transaction",
    entityId: transactionId,
  });

  revalidatePath("/admin/transactions/flagged");
  revalidatePath("/admin");
  revalidatePath("/admin/alerts");
}

export async function approveFlaggedTransactionAction(transactionId: string) {
  await resolveFlaggedTransaction(transactionId, "APPROVED");
}

export async function denyFlaggedTransactionAction(transactionId: string) {
  await resolveFlaggedTransaction(transactionId, "DENIED");
}
