"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the visual viewport so mobile keyboards resize the chat shell
 * instead of covering the composer.
 */
export function useVisualViewportHeight(offsetPx = 0) {
  const [height, setHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      const layoutHeight = window.innerHeight;
      const vvHeight = vv?.height ?? layoutHeight;
      const next = Math.max(240, Math.round(vvHeight - offsetPx));
      setHeight(next);
      setKeyboardOpen(layoutHeight - vvHeight > 120);
    };

    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [offsetPx]);

  return { height, keyboardOpen };
}
