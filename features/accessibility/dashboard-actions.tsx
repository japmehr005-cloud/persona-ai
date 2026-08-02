"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { ActionBar } from "@/features/accessibility/more-actions";
import { Button } from "@/components/ui/button";
import { SimulatePaymentDialog } from "@/features/transactions/simulate-payment-dialog";

export function DashboardActions({
  accounts,
}: {
  accounts: Array<{ id: string; name: string; mask: string }>;
}) {
  const t = useTranslations("dashboard");

  return (
    <ActionBar
      primary={
        accounts.length > 0 ? (
          <SimulatePaymentDialog accounts={accounts} />
        ) : (
          <Button asChild>
            <Link href="/transactions/import">
              <Upload />
              {t("importStatements")}
            </Link>
          </Button>
        )
      }
      secondary={
        accounts.length > 0 ? (
          <Button asChild variant="outline" className="w-full justify-start">
            <Link href="/transactions/import">
              <Upload />
              {t("importStatements")}
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}
