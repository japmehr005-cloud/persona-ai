"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const RelationshipGraphView = dynamic(
  () => import("@/features/admin/relationship-graph").then((mod) => mod.RelationshipGraphView),
  { ssr: false, loading: () => <Skeleton className="h-[560px] w-full" /> }
);
