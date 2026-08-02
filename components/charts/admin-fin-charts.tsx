"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const FinEventTrendChart = dynamic(
  () => import("@/components/charts/fin-event-trend-chart").then((mod) => mod.FinEventTrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);

export const FinEventTypeBarChart = dynamic(
  () => import("@/components/charts/fin-event-type-bar-chart").then((mod) => mod.FinEventTypeBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> }
);

export const FinEventSparklineChart = dynamic(
  () => import("@/components/charts/fin-event-sparkline-chart").then((mod) => mod.FinEventSparklineChart),
  { ssr: false, loading: () => <Skeleton className="h-[56px] w-full" /> }
);
