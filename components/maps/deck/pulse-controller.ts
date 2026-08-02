"use client";

import { useEffect, useState } from "react";

/**
 * Shared animation clock for deck.gl pulse rings and TripsLayer.
 * Uses rAF — GPU layer props update each frame, not CSS transitions.
 */
export function usePulseTime(active = true): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let cancelled = false;
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      setTime((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [active]);

  return time;
}

/** Soft 0–1 breathing wave for glow radius / alpha. */
export function pulseWave(timeSec: number, periodSec = 1.8): number {
  return 0.5 + 0.5 * Math.sin((timeSec * Math.PI * 2) / periodSec);
}
