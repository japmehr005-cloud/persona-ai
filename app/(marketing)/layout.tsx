import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { MarketingLanguageSwitcher } from "@/features/i18n/marketing-language-switcher";

export default function MarketingAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/80 via-background to-background"
      />
      <header className="relative z-10 flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-foreground">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base">Persona AI</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              Adaptive Banking Security
            </span>
          </span>
        </Link>
        <MarketingLanguageSwitcher />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}
