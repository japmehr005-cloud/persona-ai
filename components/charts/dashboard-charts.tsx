"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const SpendingAreaChart = dynamic(
  () => import("@/components/charts/spending-area-chart").then((mod) => mod.SpendingAreaChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);

export const CategoryDonutChart = dynamic(
  () => import("@/components/charts/category-donut-chart").then((mod) => mod.CategoryDonutChart),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> }
);
