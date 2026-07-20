import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/layout/page-container";

export default function AdminNotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="This page doesn't exist or may have been moved."
        action={
          <Button asChild>
            <Link href="/admin">Go to overview</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
