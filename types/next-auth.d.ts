import type { DefaultSession } from "next-auth";

type AppUserRole = "CUSTOMER" | "ANALYST" | "ADMIN";

// next-auth v5 re-exports its core `Session`/`User`/`JWT` interfaces from
// `@auth/core`. Declaration merging only takes effect on the module where an
// interface is truly declared, so we augment the `@auth/core` modules
// directly (augmenting `"next-auth"`/`"next-auth/jwt"` alone does not merge
// through their re-exports).
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: AppUserRole;
      isDemo: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppUserRole;
    isDemo: boolean;
    sessionVersion: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppUserRole;
    isDemo: boolean;
    /** Snapshot of `User.sessionVersion` at sign-in, re-checked against the
     * database on every subsequent request so "Logout all devices" can
     * invalidate already-issued JWTs immediately instead of waiting for
     * their natural expiry. */
    sessionVersion: number;
  }
}
