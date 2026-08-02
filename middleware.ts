import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";
import { isAdminRole, normalizeRole } from "@/lib/roles";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = normalizeRole(session?.user?.role);

  const isProtectedCustomerRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/assistant") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/security") ||
    pathname.startsWith("/alerts") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/dev/context-simulator");
  const isAdminRoute = pathname.startsWith("/admin");

  if (!session?.user && (isProtectedCustomerRoute || isAdminRoute)) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based access: only ADMIN / ANALYST may enter /admin/**.
  // Customers (and tokens with a missing/corrupt role) are bounced to the
  // customer dashboard — never silently allowed through.
  if (isAdminRoute && session?.user && !isAdminRole(role)) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // Analysts who land on the customer dashboard after login are sent to the
  // SOC — the dashboard is a customer surface and not their home.
  if (pathname === "/dashboard" && isAdminRole(role)) {
    return NextResponse.redirect(new URL("/admin/fin/soc", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/assistant",
    "/assistant/:path*",
    "/transactions/:path*",
    "/security/:path*",
    "/alerts/:path*",
    "/settings/:path*",
    "/verify/:path*",
    "/dev/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
