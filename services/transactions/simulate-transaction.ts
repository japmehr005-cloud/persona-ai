import {
  orchestratePayment,
  type OrchestratePaymentInput,
  type OrchestratedPaymentResult,
  type OrchestratorDecision,
} from "@/services/transactions/transaction-orchestrator";
import type { SocialEngineeringEvaluation } from "@/services/social-engineering";
import type { RiskTier } from "@/services/risk-engine/threshold-policy";

export interface SimulateTransactionInput {
  userId: string;
  accountId: string;
  merchant: string;
  category: string;
  amount: number;
  beneficiary: string | null;
  channel: "CARD" | "TRANSFER" | "ACH" | "ATM" | "ONLINE";
  fingerprintHash: string | null;
  /** When true, Social Engineering Protection will not re-pause this attempt. */
  acknowledgeSocialEngineering?: boolean;
}

export interface SimulateTransactionResult {
  transactionId: string;
  decision: OrchestratorDecision;
  score: number;
  tier: RiskTier;
  confidence: number;
  /** True once the score reaches the high-risk threshold. The customer must
   * complete the High-Risk Verification flow (`/verify/session/[id]`)
   * before a Context-Bound OTP is ever issued — see `verificationStatus`. */
  otpRequired: boolean;
  explanation: string;
  /** Plain-language recommended action for the Explainable AI panel. */
  recommendation: string;
  factors: { code: string; label: string; detail: string; contribution: number }[];
  /** "PENDING" when a High-Risk Verification context session was opened
   * (HIGH/CRITICAL or SE pause); "NONE" when the transaction was approved outright. */
  verificationStatus: "NONE" | "PENDING";
  actualAmount: number;
  baseline: {
    avgAmount: number | null;
    p95Amount: number | null;
    medianAmount: number | null;
    sampleSize: number | null;
  };
  socialEngineering: SocialEngineeringEvaluation;
}

/**
 * Simulates a live payment for demo purposes via the Transaction Orchestrator:
 * Risk Engine + Social Engineering Protection as independent layers.
 */
export async function simulateTransaction(
  input: SimulateTransactionInput
): Promise<SimulateTransactionResult> {
  const orchestrated: OrchestratedPaymentResult = await orchestratePayment(
    input as OrchestratePaymentInput
  );

  return {
    transactionId: orchestrated.transactionId,
    decision: orchestrated.decision,
    score: orchestrated.score,
    tier: orchestrated.tier,
    confidence: orchestrated.confidence,
    otpRequired: orchestrated.otpRequired,
    explanation: orchestrated.explanation,
    recommendation: orchestrated.recommendation,
    factors: orchestrated.factors,
    verificationStatus: orchestrated.verificationStatus,
    actualAmount: orchestrated.actualAmount,
    baseline: orchestrated.baseline,
    socialEngineering: orchestrated.socialEngineering,
  };
}
