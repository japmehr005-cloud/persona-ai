import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/**
 * Guards every `/admin/**` server component / action. Re-checks the live
 * database role (not just the JWT claim) so a freshly-promoted analyst is
 * admitted and a demoted one is rejected even before their JWT expires.
 */
export async function requireAnalyst() {
  const user = await requireUser();

  if (isAdminRole(user.role)) {
    return user;
  }

  // JWT may be stale (e.g. role recently changed). Confirm against the DB
  // before bouncing — this is what makes demo admin access reliable after
  // seed / privilege updates without forcing a re-login.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (dbUser && isAdminRole(dbUser.role)) {
    return { ...user, role: dbUser.role };
  }

  redirect("/dashboard");
}
