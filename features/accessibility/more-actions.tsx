"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAccessibilityOptional } from "@/features/accessibility/accessibility-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Under Senior Mode, render only primary actions inline and tuck the rest
 * behind a "More" menu. When Senior Mode is off, all children render inline.
 */
export function ActionBar({
  primary,
  secondary,
  className,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const a11y = useAccessibilityOptional();
  const seniorMode = a11y?.seniorMode ?? false;

  if (!seniorMode || !secondary) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {primary}
        {secondary}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {primary}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-h-14 gap-2 text-base" aria-label={t("moreActions")}>
            <MoreHorizontal className="size-5" />
            {t("more")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 p-2">
          <div className="flex flex-col gap-2">{secondary}</div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
