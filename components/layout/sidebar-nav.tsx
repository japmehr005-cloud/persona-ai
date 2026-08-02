"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/layout/nav-config";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  items,
  onNavigate,
  translateLabels = false,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  /** When true, resolve `labelKey` via `nav.*` messages (customer shell). */
  translateLabels?: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const labelFor = (item: { labelKey: string; label: string }) =>
    translateLabels ? t(item.labelKey as Parameters<typeof t>[0]) : item.label;

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
      {items.map((item) => {
        const hasActiveChild = item.children?.some((child) => pathname === child.href) ?? false;
        const active = isActive(pathname, item.href) || hasActiveChild;
        const Icon = item.icon;

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {labelFor(item)}
            </Link>
            {item.children && active && (
              <div className="mt-1 ml-6 flex flex-col gap-1 border-l border-sidebar-border pl-3">
                {item.children.map((child) => {
                  const childActive = pathname === child.href;
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        childActive
                          ? "text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <ChildIcon className="size-3.5 shrink-0" />
                      {labelFor(child)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
