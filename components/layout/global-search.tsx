"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export function GlobalSearch() {
  const router = useRouter();

  return (
    <form
      role="search"
      className="relative hidden flex-1 max-w-sm sm:block"
      onSubmit={(event) => {
        event.preventDefault();
        const query = new FormData(event.currentTarget).get("q");
        if (typeof query === "string" && query.trim().length > 0) {
          router.push(`/transactions?search=${encodeURIComponent(query.trim())}`);
        }
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="q"
        type="search"
        placeholder="Search transactions, merchants..."
        className="pl-8"
        aria-label="Search transactions and merchants"
      />
    </form>
  );
}
