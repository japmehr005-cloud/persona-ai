"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { TRANSACTION_CATEGORIES } from "@/lib/constants";
import { simulatePaymentAction } from "@/features/transactions/simulate-payment-actions";
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
  score: number;
  tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  explanation: string;
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

    setOutcome({
      score: response.result.score,
      tier: response.result.tier,
      confidence: response.result.confidence,
      explanation: response.result.explanation,
      otpRequired: response.result.otpRequired,
      factors: response.result.factors,
      verificationStatus: response.result.verificationStatus,
      actualAmount: response.result.actualAmount,
      baseline: response.result.baseline,
    });
    setTransactionId(response.result.transactionId);
    router.refresh();
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Zap className="size-4" />
          Simulate payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        {outcome ? (
          <>
            <DialogHeader>
              <DialogTitle>Risk assessment result</DialogTitle>
              <DialogDescription>
                The Adaptive Risk Engine scored this simulated transaction in real time.
              </DialogDescription>
            </DialogHeader>
            <RiskBreakdown
              assessment={{
                score: outcome.score,
                tier: outcome.tier,
                confidence: outcome.confidence,
                explanation: outcome.explanation,
                otpRequired: outcome.otpRequired,
                factors: outcome.factors,
                actualAmount: outcome.actualAmount,
                baseline: outcome.baseline,
              }}
            />
            {outcome.verificationStatus === "PENDING" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                This transaction is on hold. You&apos;ll need to verify your identity before a one-time
                code is issued.
              </div>
            )}
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
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Simulate a payment</DialogTitle>
              <DialogDescription>
                Demo only — creates a live transaction and runs it through the Adaptive Risk
                Engine so you can see scoring and explainability in action.
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
                  <Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}>
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
                Run risk assessment
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
