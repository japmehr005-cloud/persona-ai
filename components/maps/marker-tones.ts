export type SecurityMarkerTone = "trusted" | "current" | "attention" | "fraud";

export const MARKER_TONE_HEX: Record<SecurityMarkerTone, string> = {
  trusted: "#22c55e",
  current: "#38bdf8",
  attention: "#f59e0b",
  fraud: "#ef4444",
};

export function toneForMarker(input: {
  isCurrent?: boolean;
  riskColor: "green" | "amber" | "red";
  isImpossibleTravel?: boolean;
}): SecurityMarkerTone {
  if (input.isCurrent) return "current";
  if (input.riskColor === "red" || input.isImpossibleTravel) return "fraud";
  if (input.riskColor === "amber") return "attention";
  return "trusted";
}
