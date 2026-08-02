"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, PhoneCall, ShieldAlert, Zap } from "lucide-react";
import { toast } from "sonner";

import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { TRANSACTION_CATEGORIES } from "@/lib/constants";
import {
  cancelPausedPaymentAction,
  continuePausedPaymentAction,
  simulatePaymentAction,
} from "@/features/transactions/simulate-payment-actions";
import {
  OrchestratorDecisionBadge,
  SocialEngineeringPanel,
} from "@/features/transactions/social-engineering-panel";
import type { SocialEngineeringEvaluation } from "@/services/social-engineering";
import type { OrchestratorDecision } from "@/services/transactions/transaction-orchestrator";
import { RiskBreakdown } from "@/components/shared/risk-breakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountOption {
  id: string;
  name: string;
  mask: string;
}

const CHANNELS = [
  { value: "CARD", label: "Card" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "ACH", label: "ACH" },
  { value: "ATM", label: "ATM" },
  { value: "ONLINE", label: "Online" },
] as const;

interface SimulationOutcome {
  decision: OrchestratorDecision;
  score: number;
  tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  explanation: string;
  recommendation: string;
  otpRequired: boolean;
  factors: { code: string; label: string; detail: string; contribution: number }[];
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

function emptySocialEngineering(): SocialEngineeringEvaluation {
  return {
    triggered: false,
    signals: [],
    activeSignals: [],
    explanation: "No social engineering signals were detected for this transaction.",
    recommendedAction: "ALLOW",
  };
}

export function SimulatePaymentDialog({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SimulationOutcome | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("CARD");

  const resetForm = () => {
    setMerchant("");
    setAmount("");
    setBeneficiary("");
    setChannel("CARD");
    setOutcome(null);
    setTransactionId(null);
  };

  const applyResult = (result: SimulationOutcome & { transactionId: string }) => {
    setOutcome(result);
    setTransactionId(result.transactionId);
    router.refresh();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!accountId || !merchant.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Fill in a merchant and a positive amount to simulate a payment.");
      return;
    }

    setIsSubmitting(true);
    const fingerprint = await getDeviceFingerprint().catch(() => null);

    const response = await simulatePaymentAction({
      accountId,
      merchant: merchant.trim(),
      category: category as (typeof TRANSACTION_CATEGORIES)[number],
      amount: parsedAmount,
      beneficiary: beneficiary.trim() || undefined,
      channel,
      fingerprintHash: fingerprint?.fingerprintHash,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    applyResult({
      transactionId: response.result.transactionId,
      decision: response.result.decision,
      score: response.result.score,
      tier: response.result.tier,
      confidence: response.result.confidence,
      explanation: response.result.explanation,
      recommendation: response.result.recommendation,
      otpRequired: response.result.otpRequired,
      factors: response.result.factors,
      verificationStatus: response.result.verificationStatus,
      actualAmount: response.result.actualAmount,
      baseline: response.result.baseline,
      socialEngineering: response.result.socialEngineering,
    });
  };

  const handleContinueAnyway = async () => {
    if (!transactionId) return;
    setIsSubmitting(true);
    const response = await continuePausedPaymentAction(transactionId);
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    applyResult({
      transactionId: response.result.transactionId,
      decision: response.result.decision,
      score: response.result.score,
      tier: response.result.tier,
      confidence: response.result.confidence,
      explanation: response.result.explanation,
      recommendation: response.result.recommendation,
      otpRequired: response.result.otpRequired,
      factors: response.result.factors,
      verificationStatus: response.result.verificationStatus,
      actualAmount: response.result.actualAmount,
      baseline: response.result.baseline,
      socialEngineering: response.result.socialEngineering ?? emptySocialEngineering(),
    });
  };

  const handleCancelTransaction = async () => {
    if (!transactionId) return;
    setIsSubmitting(true);
    const response = await cancelPausedPaymentAction(transactionId);
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    toast.message("Transaction cancelled for your protection.");
    if (outcome) {
      setOutcome({
        ...outcome,
        decision: "BLOCKED",
        socialEngineering: outcome.socialEngineering,
      });
    }
    router.refresh();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };

  const isPaused = outcome?.decision === "PAUSED_FOR_VERIFICATION";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Zap className="size-4" />
          Simulate payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <AnimatePresence mode="wait">
          {isPaused && outcome ? (
            <motion.div
              key="se-pause"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <PhoneCall className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <DialogTitle className="text-lg">Potential Social Engineering Attack</DialogTitle>
                    <DialogDescription className="text-base leading-relaxed">
                      We noticed that you appear to be on an active phone call.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm leading-relaxed text-foreground">
                <p>
                  Scammers often convince victims to transfer money while remaining on the call.
                </p>
                <p>
                  This transaction to <span className="font-semibold">{merchant || "the payee"}</span>{" "}
                  for ₹{Number(amount || outcome.actualAmount).toLocaleString("en-IN")} has been
                  temporarily paused for your protection.
                </p>
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Please complete an additional verification before proceeding.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Independent security layers
                </p>
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Risk Score</span>
                    <span className="font-mono text-lg font-semibold">{outcome.score}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {outcome.tier.charAt(0) + outcome.tier.slice(1).toLowerCase()} risk — unchanged by
                    the phone call signal
                  </p>
                </div>
                <SocialEngineeringPanel evaluation={outcome.socialEngineering} />
                <OrchestratorDecisionBadge decision={outcome.decision} />
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  className="w-full"
                  disabled={isSubmitting || !transactionId}
                  onClick={() => router.push(`/verify/session/${transactionId}`)}
                >
                  <ShieldAlert className="size-4" />
                  Verify Identity
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={handleCancelTransaction}
                >
                  Cancel Transaction
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  disabled={isSubmitting}
                  onClick={handleContinueAnyway}
                >
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Continue Anyway
                </Button>
              </DialogFooter>
            </motion.div>
          ) : outcome ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>Payment security decision</DialogTitle>
                <DialogDescription>
                  Risk Engine and Social Engineering Protection ran as separate layers.
                </DialogDescription>
              </DialogHeader>

              <OrchestratorDecisionBadge decision={outcome.decision} />

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Risk Analysis
                </p>
                <RiskBreakdown
                  assessment={{
                    score: outcome.score,
                    tier: outcome.tier,
                    confidence: outcome.confidence,
                    explanation: outcome.explanation,
                    recommendation: outcome.recommendation,
                    otpRequired: outcome.otpRequired,
                    factors: outcome.factors,
                    actualAmount: outcome.actualAmount,
                    baseline: outcome.baseline,
                  }}
                />
              </div>

              <SocialEngineeringPanel evaluation={outcome.socialEngineering} />

              <DialogFooter>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
                {outcome.verificationStatus === "PENDING" && transactionId ? (
                  <Button onClick={() => router.push(`/verify/session/${transactionId}`)}>
                    Review &amp; verify
                  </Button>
                ) : (
                  transactionId && (
                    <Button onClick={() => router.push(`/transactions/${transactionId}`)}>
                      View transaction
                    </Button>
                  )
                )}
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
            >
              <DialogHeader>
                <DialogTitle>Simulate a payment</DialogTitle>
                <DialogDescription>
                  Runs the Adaptive Risk Engine, then Social Engineering Protection — two
                  independent security systems.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sim-account">Account</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="sim-account" className="w-full">
                      <SelectValue placeholder="Select an account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ···· {account.mask}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sim-merchant">Merchant</Label>
                    <Input
                      id="sim-merchant"
                      value={merchant}
                      onChange={(event) => setMerchant(event.target.value)}
                      placeholder="e.g. Unfamiliar Payee Pvt Ltd"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sim-amount">Amount</Label>
                    <Input
                      id="sim-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sim-category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="sim-category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSACTION_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sim-channel">Channel</Label>
                    <Select
                      value={channel}
                      onValueChange={(value) => setChannel(value as typeof channel)}
                    >
                      <SelectTrigger id="sim-channel" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNELS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sim-beneficiary">Beneficiary (optional)</Label>
                  <Input
                    id="sim-beneficiary"
                    value={beneficiary}
                    onChange={(event) => setBeneficiary(event.target.value)}
                    placeholder="e.g. R. Sharma"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Analyse payment
                </Button>
              </DialogFooter>
            </motion.form>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
