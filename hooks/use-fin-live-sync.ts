"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to `/api/fin/stream` (SSE) and invokes `onUpdate` whenever FIN
 * records a new event or session. Automatically reconnects after the server
 * closes the short-lived stream (Vercel-friendly). Falls back to a plain
 * interval poll of `onUpdate` if EventSource is unavailable.
 */
export function useFinLiveSync(onUpdate: () => void | Promise<void>, enabled = true) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    let closed = false;
    let source: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const runUpdate = () => {
      void Promise.resolve(onUpdateRef.current()).catch(() => {
        // Live sync must never surface errors into the UI.
      });
    };

    const connect = () => {
      if (closed) return;
      if (typeof EventSource === "undefined") {
        fallbackTimer = setInterval(runUpdate, 5000);
        return;
      }

      const since = encodeURIComponent(new Date(Date.now() - 30_000).toISOString());
      source = new EventSource(`/api/fin/stream?since=${since}`);

      source.addEventListener("fin-update", () => runUpdate());
      source.addEventListener("reconnect", () => {
        source?.close();
        reconnectTimer = setTimeout(connect, 250);
      });
      source.onerror = () => {
        source?.close();
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      closed = true;
      source?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [enabled]);
}
