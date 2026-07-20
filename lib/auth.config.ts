import type { NextAuthConfig } from "next-auth";

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
        token.role = user.role as "CUSTOMER" | "ANALYST" | "ADMIN";
        token.isDemo = user.isDemo as boolean;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isDemo = token.isDemo;
      }
      return session;
    },
  },
};
