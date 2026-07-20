"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Persona AI] Fatal application error:", error);
  }, [error]);

  return (
    <html lang="en" className="antialiased">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">Persona AI is unavailable</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            A critical error occurred. Please refresh the page or try again shortly.
          </p>
        </div>
        <Button onClick={() => reset()}>Try again</Button>
      </body>
    </html>
  );
}
