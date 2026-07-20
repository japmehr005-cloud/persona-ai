"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const AlertTrendChart = dynamic(
  () => import("@/components/charts/alert-trend-chart").then((mod) => mod.AlertTrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);

export const CategoryRiskBarChart = dynamic(
  () => import("@/components/charts/category-risk-bar-chart").then((mod) => mod.CategoryRiskBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);

export const DispositionDonutChart = dynamic(
  () => import("@/components/charts/disposition-donut-chart").then((mod) => mod.DispositionDonutChart),
  { ssr: false, loading: () => <Skeleton className="h-[180px] w-full" /> }
);
