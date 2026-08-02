"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ADMIN_NAV, CUSTOMER_NAV, DEV_NAV_ITEM } from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface AppShellProps {
  variant: "customer" | "admin";
  includeDevNav?: boolean;
  brandHref: string;
  brandLabel: string;
  header: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  variant,
  includeDevNav = false,
  brandHref,
  brandLabel,
  header,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const tCommon = useTranslations("common");
  const sidebarAccent = variant === "admin" ? "admin" : "default";
  const navItems =
    variant === "admin" ? ADMIN_NAV : includeDevNav ? [...CUSTOMER_NAV, DEV_NAV_ITEM] : CUSTOMER_NAV;
  const translateLabels = variant === "customer";
  const resolvedBrand = variant === "customer" ? tCommon("appName") : brandLabel;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <Link href={brandHref} className="flex items-center gap-2 font-semibold">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              sidebarAccent === "admin" ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
            )}
          >
            <ShieldCheck className="size-4" />
          </span>
          <span className="text-sm leading-tight">
            {resolvedBrand}
            {sidebarAccent === "admin" && (
              <span className="block text-[11px] font-normal text-sidebar-foreground/50">
                Operations Console
              </span>
            )}
          </span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav
          items={navItems}
          translateLabels={translateLabels}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
        <div className="fixed inset-y-0 left-0 w-64">{sidebarContent}</div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <VisuallyHidden>
            <SheetTitle>{tCommon("openNavigation")}</SheetTitle>
          </VisuallyHidden>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={tCommon("openNavigation")}
          >
            <Menu />
          </Button>
          {header}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
