import { prisma } from "@/lib/prisma";

export interface FinRiskFactorResult {
  code: string;
  label: string;
  detail: string;
  weight: number;
  contribution: number;
}

const OPEN_REPORT_WEIGHT_PER_REPORT = 10;
const OPEN_REPORT_WEIGHT_CAP = 25;
const CLUSTER_DEVICE_WEIGHT = 30;
const CLUSTER_BENEFICIARY_WEIGHT = 25;

/**
 * Pulls every FIN-derived signal relevant to a single risk assessment
 * (transaction or login): the user's own open fraud reports, and whether
 * the device/beneficiary involved is already linked to a known fraud
 * cluster. This is the reusable "FIN → Risk Engine" contract described in
 * the FIN architecture rule — the Risk Engine calls this instead of
 * querying `FraudReport`/`FraudClusterMember` directly.
 */
export async function getFinRiskFactors(
  userId: string,
  options: { deviceFingerprintHash?: string | null; beneficiary?: string | null }
): Promise<FinRiskFactorResult[]> {
  const factors: FinRiskFactorResult[] = [];

  const openReportCount = await prisma.fraudReport.count({
    where: { reporterUserId: userId, status: "OPEN" },
  });

  if (openReportCount > 0) {
    const weight = Math.min(OPEN_REPORT_WEIGHT_CAP, openReportCount * OPEN_REPORT_WEIGHT_PER_REPORT);
    factors.push({
      code: "FIN_OPEN_FRAUD_REPORT",
      label: "Open fraud report on this account",
      detail: `You have ${openReportCount} open fraud report${openReportCount > 1 ? "s" : ""} under review.`,
      weight,
      contribution: weight,
    });
  }

  if (options.deviceFingerprintHash) {
    const clusterMember = await prisma.fraudClusterMember.findFirst({
      where: { entityType: "DEVICE", entityValue: options.deviceFingerprintHash },
    });
    if (clusterMember) {
      factors.push({
        code: "FIN_DEVICE_CLUSTER_MATCH",
        label: "Device linked to a fraud cluster",
        detail: "This device has been reported as suspicious by another customer.",
        weight: CLUSTER_DEVICE_WEIGHT,
        contribution: CLUSTER_DEVICE_WEIGHT,
      });
    }
  }

  if (options.beneficiary) {
    const clusterMember = await prisma.fraudClusterMember.findFirst({
      where: { entityType: "BENEFICIARY", entityValue: options.beneficiary.toLowerCase().trim() },
    });
    if (clusterMember) {
      factors.push({
        code: "FIN_BENEFICIARY_CLUSTER_MATCH",
        label: "Recipient linked to a fraud cluster",
        detail: "This recipient has been reported as suspicious by another customer.",
        weight: CLUSTER_BENEFICIARY_WEIGHT,
        contribution: CLUSTER_BENEFICIARY_WEIGHT,
      });
    }
  }

  return factors;
}
