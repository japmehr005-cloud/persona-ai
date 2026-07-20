"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

import { demoLoginAction } from "@/lib/auth-actions";

export function DemoEntry() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={demoLoginAction} className="flex flex-col items-center gap-3">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Provisioning your demo workspace…</p>
      <noscript>
        <button
          type="submit"
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Continue
        </button>
      </noscript>
    </form>
  );
}
