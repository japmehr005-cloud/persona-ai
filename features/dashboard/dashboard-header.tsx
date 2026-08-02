"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { DashboardActions } from "@/features/accessibility/dashboard-actions";

export function DashboardHeader({
  firstName,
  accounts,
}: {
  firstName: string | null | undefined;
  accounts: Array<{ id: string; name: string; mask: string }>;
}) {
  const t = useTranslations("dashboard");
  return (
    <PageHeader
      title={t("title", { name: firstName?.trim() || t("titleFallback") })}
      description={t("description")}
      actions={<DashboardActions accounts={accounts} />}
    />
  );
}
