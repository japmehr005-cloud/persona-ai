import type { DefaultSession } from "next-auth";

type AppUserRole = "CUSTOMER" | "ANALYST" | "ADMIN";

// Mirrors the Prisma `SessionAuthMethod` enum (kept as a literal union here,
// rather than imported from `@prisma/client`, so this Edge-safe type module
// never pulls in the Prisma client). Captures which authentication method
// actually won at sign-in — distinct from `PreferredAuthMethod`, which is
// only ever a customer's stated preference.
type AppSessionAuthMethod = "PASSWORD_ONLY" | "PASSWORD_OTP" | "PASSWORD_BIOMETRIC" | "AUTHENTICATOR" | "TOTP_2FA";

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
      /** The method that won at sign-in for this session's JWT — read by
       * `registerDeviceAction` so the FIN Security Map can show which
       * authentication method protected each login without a client round
       * trip. */
      authMethod: AppSessionAuthMethod;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppUserRole;
    isDemo: boolean;
    sessionVersion: number;
    authMethod: AppSessionAuthMethod;
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
    authMethod: AppSessionAuthMethod;
  }
}
