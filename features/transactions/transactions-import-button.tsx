"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function TransactionsImportButton() {
  const t = useTranslations("transactions");
  return (
    <Button asChild variant="outline">
      <Link href="/transactions/import">
        <Upload />
        {t("import")}
      </Link>
    </Button>
  );
}
