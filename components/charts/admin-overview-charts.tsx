"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const RiskDistributionBar = dynamic(
  () => import("@/components/charts/risk-distribution-bar").then((mod) => mod.RiskDistributionBar),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);
