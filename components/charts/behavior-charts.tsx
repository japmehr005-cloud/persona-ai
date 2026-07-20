"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const ActivityHourChart = dynamic(
  () => import("@/components/charts/activity-hour-chart").then((mod) => mod.ActivityHourChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);

export const MerchantBarChart = dynamic(
  () => import("@/components/charts/merchant-bar-chart").then((mod) => mod.MerchantBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);
