/**
 * Shared role helpers used by Edge middleware, Node session guards, and
 * post-login redirects. Kept free of Prisma / Node-only imports so it can
 * safely ship inside the Edge-safe auth config.
 */

export type AppUserRole = "CUSTOMER" | "ANALYST" | "ADMIN";

const ADMIN_ROLES = new Set<string>(["ADMIN", "ANALYST"]);

export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.has(role.toUpperCase());
}

export function normalizeRole(role: unknown): AppUserRole | null {
  if (typeof role !== "string") return null;
  const upper = role.toUpperCase();
  if (upper === "ADMIN" || upper === "ANALYST" || upper === "CUSTOMER") return upper;
  return null;
}

/** Post-login landing page — analysts land in the SOC, customers on their dashboard. */
export function homePathForRole(role: string | null | undefined): string {
  return isAdminRole(role) ? "/admin/fin/soc" : "/dashboard";
}
