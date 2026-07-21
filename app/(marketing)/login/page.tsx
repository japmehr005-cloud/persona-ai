import type { Metadata } from "next";

import { demoLoginAction } from "@/lib/auth-actions";
import { LoginForm } from "@/features/auth/login-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <LoginForm />
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">OR</span>
        <Separator className="flex-1" />
      </div>
      <form action={demoLoginAction}>
        <Button type="submit" variant="outline" className="w-full">
          Explore with a demo workspace
        </Button>
      </form>
      {error === "demo-unavailable" && (
        <p className="text-center text-xs text-muted-foreground">
          Demo workspace is being provisioned. Please try again shortly.
        </p>
      )}
      {error === "2fa-expired" && (
        <p className="text-center text-xs text-muted-foreground">
          That sign-in session expired. Please sign in again.
        </p>
      )}
    </div>
  );
}
