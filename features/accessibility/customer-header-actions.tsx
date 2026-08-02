"use client";

import type { ReactNode } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAccessibilityOptional } from "@/features/accessibility/accessibility-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CustomerHeaderActions({
  searchSlot,
  notificationsSlot,
  userMenuSlot,
}: {
  searchSlot: ReactNode;
  notificationsSlot: ReactNode;
  userMenuSlot: ReactNode;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const a11y = useAccessibilityOptional();
  const seniorMode = a11y?.seniorMode ?? false;

  if (!seniorMode) {
    return (
      <div className="flex flex-1 items-center gap-4">
        {searchSlot}
        <div className="ml-auto flex items-center gap-1">
          {notificationsSlot}
          {userMenuSlot}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-3">
      <p className="truncate text-base font-medium text-foreground sm:text-lg">
        {t("yourSecurityHome")}
      </p>
      <div className="ml-auto flex items-center gap-2">
        {notificationsSlot}
        {userMenuSlot}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={tCommon("moreActions")}
              className="min-h-12 min-w-12"
            >
              <MoreHorizontal className="size-5" />
              <span className="sr-only">{tCommon("more")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <div className="px-2 py-2">
              <p className="mb-2 flex items-center gap-2 text-base font-medium">
                <Search className="size-4" aria-hidden />
                {tCommon("search")}
              </p>
              {searchSlot}
            </div>
            <DropdownMenuItem asChild className="min-h-12 text-base">
              <a href="/settings?tab=accessibility">{t("accessibilitySettings")}</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
