import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const ADMIN_ROLES = new Set(["ADMIN", "ANALYST"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isProtectedCustomerRoute =
    pathname.startsWith("/dashboard") ||
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

  if (isAdminRoute && session?.user && !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/security/:path*",
    "/alerts/:path*",
    "/settings/:path*",
    "/verify/:path*",
    "/dev/:path*",
    "/admin/:path*",
  ],
};
