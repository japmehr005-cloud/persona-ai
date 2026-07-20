import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH";

const TIER_CONFIG: Record<RiskTier, { label: string; variant: "success" | "warning" | "destructive" }> = {
  LOW: { label: "Low risk", variant: "success" },
  MEDIUM: { label: "Medium risk", variant: "warning" },
  HIGH: { label: "High risk", variant: "destructive" },
};

export function RiskBadge({ tier, className }: { tier: RiskTier; className?: string }) {
  const config = TIER_CONFIG[tier];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          tier === "LOW" && "bg-success",
          tier === "MEDIUM" && "bg-warning",
          tier === "HIGH" && "bg-destructive"
        )}
      />
      {config.label}
    </Badge>
  );
}
