import { prisma } from "@/lib/prisma";
import type { ClusterRiskLevel } from "@prisma/client";
import { recordFinEvent } from "@/services/fin/fin-event-logger";

/**
 * Incremental fraud clustering: groups reporters of OPEN/CONFIRMED
 * `FraudReport`s that share a device fingerprint or a beneficiary. Two or
 * more *distinct* customers reporting the same device/beneficiary as
 * suspicious is a materially stronger signal than either report alone —
 * that's exactly what a `FraudCluster` captures for the Admin SOC's
 * relationship graph and clusters view.
 *
 * Deliberately on-demand (an admin action) rather than a cron/queue job —
 * appropriate for a hackathon deployment target with no background-worker
 * infrastructure; the same grouping logic could be wrapped in a scheduled
 * job later without changing this function's contract.
 */
export async function recomputeClusters(): Promise<{ clustersCreated: number; clustersUpdated: number }> {
  const reports = await prisma.fraudReport.findMany({
    where: { status: { in: ["OPEN", "CONFIRMED"] } },
    include: { device: { select: { fingerprintHash: true } } },
  });

  const deviceGroups = new Map<string, Set<string>>();
  const beneficiaryGroups = new Map<string, Set<string>>();

  for (const report of reports) {
    if (report.device) {
      addToGroup(deviceGroups, report.device.fingerprintHash, report.reporterUserId);
    }
    if (report.beneficiary) {
      addToGroup(beneficiaryGroups, report.beneficiary.toLowerCase().trim(), report.reporterUserId);
    }
  }

  let clustersCreated = 0;
  let clustersUpdated = 0;

  for (const [fingerprintHash, userIds] of deviceGroups) {
    if (userIds.size < 2) continue;
    const outcome = await upsertClusterForGroup(
      "DEVICE",
      fingerprintHash,
      `Shared device ${fingerprintHash.slice(0, 10)}`,
      userIds
    );
    if (outcome === "created") clustersCreated += 1;
    else clustersUpdated += 1;
  }

  for (const [beneficiary, userIds] of beneficiaryGroups) {
    if (userIds.size < 2) continue;
    const outcome = await upsertClusterForGroup(
      "BENEFICIARY",
      beneficiary,
      `Shared recipient "${beneficiary}"`,
      userIds
    );
    if (outcome === "created") clustersCreated += 1;
    else clustersUpdated += 1;
  }

  return { clustersCreated, clustersUpdated };
}

function addToGroup(map: Map<string, Set<string>>, key: string, userId: string) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(userId);
}

function riskLevelForSize(size: number): ClusterRiskLevel {
  if (size >= 4) return "CRITICAL";
  if (size >= 3) return "ELEVATED";
  return "WATCH";
}

async function upsertClusterForGroup(
  entityType: "DEVICE" | "BENEFICIARY",
  entityValue: string,
  label: string,
  userIds: Set<string>
): Promise<"created" | "updated"> {
  const existingMember = await prisma.fraudClusterMember.findFirst({
    where: { entityType, entityValue },
    include: { cluster: { include: { members: true } } },
  });

  const riskLevel = riskLevelForSize(userIds.size);

  if (!existingMember) {
    const cluster = await prisma.fraudCluster.create({
      data: {
        label,
        riskLevel,
        summary: `${userIds.size} customers linked via a shared ${entityType.toLowerCase()}.`,
        members: {
          create: [
            { entityType, entityValue },
            ...Array.from(userIds).map((userId) => ({ entityType: "USER" as const, entityValue: userId })),
          ],
        },
      },
    });

    await recordFinEvent({
      type: "CLUSTER_CREATED",
      severity: riskLevel === "CRITICAL" ? "HIGH" : "MEDIUM",
      summary: `New fraud cluster detected: ${label}`,
      metadata: { clusterId: cluster.id, entityType, entityValue, memberCount: userIds.size },
    });

    return "created";
  }

  const clusterId = existingMember.clusterId;
  const existingUserValues = new Set(
    existingMember.cluster.members.filter((member) => member.entityType === "USER").map((member) => member.entityValue)
  );
  const newUserIds = Array.from(userIds).filter((userId) => !existingUserValues.has(userId));

  await prisma.$transaction([
    prisma.fraudCluster.update({ where: { id: clusterId }, data: { riskLevel } }),
    ...(newUserIds.length > 0
      ? [
          prisma.fraudClusterMember.createMany({
            data: newUserIds.map((userId) => ({ clusterId, entityType: "USER" as const, entityValue: userId })),
          }),
        ]
      : []),
  ]);

  if (newUserIds.length > 0) {
    await recordFinEvent({
      type: "CLUSTER_LINKED",
      severity: "MEDIUM",
      summary: `${newUserIds.length} more customer(s) linked to fraud cluster: ${label}`,
      metadata: { clusterId, entityType, entityValue },
    });
  }

  return "updated";
}

export interface FraudClusterView {
  id: string;
  label: string;
  riskLevel: ClusterRiskLevel;
  summary: string | null;
  memberCount: number;
  userMembers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getFraudClusters(): Promise<FraudClusterView[]> {
  const clusters = await prisma.fraudCluster.findMany({
    orderBy: { updatedAt: "desc" },
    include: { members: true },
  });

  const userIds = clusters.flatMap((cluster) =>
    cluster.members.filter((member) => member.entityType === "USER").map((member) => member.entityValue)
  );
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userNameById = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]));

  return clusters.map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    riskLevel: cluster.riskLevel,
    summary: cluster.summary,
    memberCount: cluster.members.length,
    userMembers: cluster.members
      .filter((member) => member.entityType === "USER")
      .map((member) => userNameById.get(member.entityValue) ?? "Unknown customer"),
    createdAt: cluster.createdAt,
    updatedAt: cluster.updatedAt,
  }));
}
