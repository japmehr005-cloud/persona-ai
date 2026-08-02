"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";

type Namespace =
  | "dashboard"
  | "transactions"
  | "alerts"
  | "security"
  | "settings"
  | "assistant";

export function TranslatedPageHeader({
  namespace,
  titleKey = "title",
  descriptionKey = "description",
  titleValues,
  actions,
}: {
  namespace: Namespace;
  titleKey?: string;
  descriptionKey?: string;
  titleValues?: Record<string, string | number | Date>;
  actions?: ReactNode;
}) {
  const t = useTranslations(namespace);
  return (
    <PageHeader
      title={t(titleKey as never, titleValues as never)}
      description={t(descriptionKey as never)}
      actions={actions}
    />
  );
}
