import type { NextAuthConfig } from "next-auth";

import { normalizeRole } from "@/lib/roles";

// Edge-safe subset of the Auth.js configuration. `middleware.ts` runs on the
// Edge runtime and only needs to read/shape the session JWT — it must never
// import the Credentials provider's `authorize` callback, since that pulls
// in bcrypt and Prisma (Node-only). The full provider list lives in
// `lib/auth.ts`, which is only ever imported from Node runtime code
// (server components, route handlers, server actions).
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = normalizeRole(user.role) ?? "CUSTOMER";
        token.isDemo = Boolean(user.isDemo);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Normalize on every read so middleware / requireAnalyst never see a
        // stale or oddly-cased role string from an older JWT.
        session.user.role = normalizeRole(token.role) ?? "CUSTOMER";
        session.user.isDemo = Boolean(token.isDemo);
        session.user.authMethod = token.authMethod;
      }
      return session;
    },
  },
};
