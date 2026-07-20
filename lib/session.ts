import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireAnalyst() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "ANALYST") {
    redirect("/dashboard");
  }
  return user;
}
