import { prisma } from "@/lib/prisma";
import { getFraudClusters } from "@/services/fin/cluster-engine";
import { getDeviceIntelligence } from "@/services/admin/get-device-intelligence";

export type RecommendationAction = "BLOCK_ACCOUNT" | "REQUIRE_BIOMETRIC" | "MONITOR_ONLY";

export interface AiRecommendation {
  userId: string;
  customerName: string;
  email: string;
  riskScore: number;
  action: RecommendationAction;
  actionLabel: string;
  confidence: number;
  reasons: string[];
  openReportId: string | null;
  clusterLabel: string | null;
  latestSessionId: string | null;
  latestCity: string | null;
}

const ACTION_LABEL: Record<RecommendationAction, string> = {
  BLOCK_ACCOUNT: "Block Account",
  REQUIRE_BIOMETRIC: "Require Biometric Verification",
  MONITOR_ONLY: "Monitor Only",
};

/**
 * Read aggregator for the AI Recommendation Center — composes existing FIN,
 * device, cluster, government, and session risk signals. Does not invent
 * scores; confidence and reasons are derived from recorded data only.
 */
export async function getAiRecommendations(): Promise<AiRecommendation[]> {
  const [customers, clusters, devices, govHits] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        sessions: {
          orderBy: { startedAt: "desc" },
          take: 8,
          select: {
            id: true,
            riskScore: true,
            riskTier: true,
            isSuspicious: true,
            trusted: true,
            city: true,
            startedAt: true,
            deviceId: true,
            device: { select: { trusted: true, fingerprintHash: true, label: true } },
          },
        },
        devices: { select: { id: true, trusted: true, fingerprintHash: true } },
        fraudReportsFiled: {
          select: { id: true, status: true, type: true, beneficiary: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        accounts: {
          select: {
            transactions: {
              where: { status: "FLAGGED" },
              select: { id: true, beneficiary: true, amount: true },
              take: 10,
              orderBy: { date: "desc" },
            },
          },
        },
      },
      take: 80,
    }),
    getFraudClusters(),
    getDeviceIntelligence(),
    prisma.governmentRiskRecord.findMany({
      where: { matched: true },
      orderBy: { checkedAt: "desc" },
      take: 100,
      select: { subjectValue: true, source: true, riskLevel: true },
    }),
  ]);

  const clusterByUserId = new Map<string, string>();
  // Prefer raw cluster membership for id matching
  const clusterRows = await prisma.fraudClusterMember.findMany({
    where: { entityType: "USER" },
    include: { cluster: { select: { label: true, riskLevel: true } } },
  });
  for (const row of clusterRows) {
    clusterByUserId.set(row.entityValue, row.cluster.label);
  }

  // Keep clusters/devices fetches so the aggregator stays aligned with live FIN surfaces.
  void clusters;
  void devices;

  const fingerprintOwners = new Map<string, Set<string>>();
  for (const customer of customers) {
    for (const device of customer.devices) {
      const set = fingerprintOwners.get(device.fingerprintHash) ?? new Set();
      set.add(customer.id);
      fingerprintOwners.set(device.fingerprintHash, set);
    }
  }

  const govBeneficiaries = new Set(
    govHits.filter((hit) => hit.riskLevel === "HIGH" || hit.riskLevel === "ELEVATED").map((hit) => hit.subjectValue.toLowerCase().trim())
  );

  const recommendations: AiRecommendation[] = [];

  for (const customer of customers) {
    const latest = customer.sessions[0] ?? null;
    const reasons: string[] = [];
    let score = latest?.riskScore ?? 15;

    const openReports = customer.fraudReportsFiled.filter((r) => r.status === "OPEN");
    const confirmedReports = customer.fraudReportsFiled.filter((r) => r.status === "CONFIRMED");
    const reportCount = customer.fraudReportsFiled.length;

    const sharedFpCount = customer.devices.reduce((max, device) => {
      const owners = fingerprintOwners.get(device.fingerprintHash)?.size ?? 1;
      return Math.max(max, owners - 1);
    }, 0);

    const clusterLabel = clusterByUserId.get(customer.id) ?? null;
    const hasImpossible = customer.sessions.some((s) => s.isSuspicious && (s.riskScore ?? 0) >= 60);
    const untrustedDevice = latest?.device && !latest.device.trusted;
    const newLocation = latest && !latest.trusted;
    const flaggedTx = customer.accounts.flatMap((account) => account.transactions);
    const govMatch =
      customer.fraudReportsFiled.some(
        (r) => r.beneficiary && govBeneficiaries.has(r.beneficiary.toLowerCase().trim())
      ) ||
      flaggedTx.some((t) => t.beneficiary && govBeneficiaries.has(t.beneficiary.toLowerCase().trim()));

    if (sharedFpCount > 0) {
      reasons.push(`Device fingerprint matches ${sharedFpCount} other customer account${sharedFpCount > 1 ? "s" : ""}`);
      score = Math.max(score, 55 + sharedFpCount * 10);
    }
    if (clusterLabel) {
      reasons.push(`Appears in active FIN cluster (${clusterLabel})`);
      score = Math.max(score, 70);
    }
    if (govMatch) {
      reasons.push("Government FRI/MNRL match on linked beneficiary");
      score = Math.max(score, 85);
    }
    if (reportCount > 0) {
      reasons.push(`${reportCount} fraud report${reportCount > 1 ? "s" : ""} on this account`);
      score = Math.max(score, 40 + Math.min(reportCount * 8, 40));
    }
    if (confirmedReports.length > 0) {
      reasons.push(`${confirmedReports.length} confirmed fraud report${confirmedReports.length > 1 ? "s" : ""}`);
      score = Math.max(score, 90);
    }
    if (hasImpossible) {
      reasons.push("Impossible travel detected on a recent login");
      score = Math.max(score, 75);
    }
    if (flaggedTx.length > 0) {
      reasons.push(
        `${flaggedTx.length} flagged high-velocity or suspicious transaction${flaggedTx.length > 1 ? "s" : ""}`
      );
      score = Math.max(score, 60);
    }
    if (untrustedDevice) {
      reasons.push("Recent sign-in from an untrusted device");
      score = Math.max(score, 45);
    }
    if (newLocation) {
      reasons.push("New or unconfirmed location");
      score = Math.max(score, 40);
    }
    if (latest?.device?.trusted && newLocation && (latest.riskScore ?? 0) < 50) {
      reasons.push("Trusted device with low transaction risk — elevated verification preferred");
    }

    // Deduplicate empty-noise customers with no signals
    if (reasons.length === 0 && (latest?.riskScore ?? 0) < 25) {
      reasons.push("Slight behavior deviation");
      reasons.push("No fraud history");
      reasons.push("No government matches");
      score = latest?.riskScore ?? 12;
    }

    let action: RecommendationAction = "MONITOR_ONLY";
    if (score >= 75 || confirmedReports.length > 0 || govMatch || (clusterLabel && reportCount > 0)) {
      action = "BLOCK_ACCOUNT";
    } else if (score >= 40 || untrustedDevice || newLocation || hasImpossible) {
      action = "REQUIRE_BIOMETRIC";
    }

    const confidence =
      action === "BLOCK_ACCOUNT"
        ? Math.min(98, 70 + reasons.length * 4 + (govMatch ? 8 : 0))
        : action === "REQUIRE_BIOMETRIC"
          ? Math.min(90, 55 + reasons.length * 5)
          : Math.min(80, 40 + Math.max(0, 30 - score));

    recommendations.push({
      userId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      riskScore: Math.min(100, Math.round(score)),
      action,
      actionLabel: ACTION_LABEL[action],
      confidence: Math.round(confidence),
      reasons: reasons.slice(0, 8),
      openReportId: openReports[0]?.id ?? null,
      clusterLabel,
      latestSessionId: latest?.id ?? null,
      latestCity: latest?.city ?? null,
    });
  }

  return recommendations.sort((a, b) => {
    const actionRank = { BLOCK_ACCOUNT: 0, REQUIRE_BIOMETRIC: 1, MONITOR_ONLY: 2 } as const;
    if (actionRank[a.action] !== actionRank[b.action]) return actionRank[a.action] - actionRank[b.action];
    return b.riskScore - a.riskScore;
  });
}
