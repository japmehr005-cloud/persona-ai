"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";

const DISMISS_KEY = "securebank-demo-banner-dismissed";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-warning/20 bg-warning/10 px-4 py-2 text-sm text-warning sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 shrink-0" />
        <span>
          Simulated banking environment — data, transactions and context signals are for
          demonstration only. No real funds are held or moved.
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="shrink-0 rounded-md p-1 text-warning/70 transition-colors hover:bg-warning/10 hover:text-warning"
        aria-label="Dismiss demo environment notice"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
