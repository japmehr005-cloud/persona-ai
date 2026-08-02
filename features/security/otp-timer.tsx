"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function OtpTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: Date;
  onExpire?: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(() => expiresAt.getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const next = expiresAt.getTime() - Date.now();
      setRemainingMs(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (remainingMs <= 0) onExpire?.();
  }, [remainingMs, onExpire]);

  const isExpiring = remainingMs > 0 && remainingMs <= 15_000;

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium tabular-nums",
        remainingMs <= 0 ? "text-destructive" : isExpiring ? "text-warning" : "text-muted-foreground"
      )}
      role="timer"
      aria-live="polite"
    >
      <Clock className="size-4" />
      {remainingMs <= 0 ? "Expired" : `Expires in ${formatRemaining(remainingMs)}`}
    </span>
  );
}
