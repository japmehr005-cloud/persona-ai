import type { Metadata } from "next";

import { DemoEntry } from "@/features/auth/demo-entry";

export const metadata: Metadata = { title: "Demo workspace" };

export default function DemoPage() {
  return <DemoEntry />;
}
