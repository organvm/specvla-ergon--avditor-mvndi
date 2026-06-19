import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"

// Auth module must NOT import config.ts or db.ts — those pull in
// better-sqlite3 (native C++ addon) which crashes Vercel's SSR runtime.
// All config here uses environment variables only.

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin@growthauditor.ai").split(",");
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "cosmic"; // allow-secret

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        // allow-secret
        password: { label: "Password", type: "password" }, // allow-secret
      },
      authorize: async (credentials) => {
        if (credentials.password === AUTH_PASSWORD && typeof credentials.email === "string") { // allow-secret
          const isAdmin = ADMIN_EMAILS.some(e => credentials.email === e.trim());
          return {
            id: "1",
            email: credentials.email,
            name: credentials.email.split("@")[0],
            isAdmin
          }
        }
        return null
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.isPro = token.isPro as boolean;
      }
      return session;
    },
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email) as string | undefined;
      if (email) {
        const isAdmin = ADMIN_EMAILS.some(e => email === e.trim());
        token.isAdmin = isAdmin;

        // Subscription check — lazy import to avoid bundling better-sqlite3
        // into the auth module's SSR bundle
        try {
          const db = await import("./lib/db");
          const sub = await db.getSubscription(email as string);
          token.isPro = sub?.plan === "pro" && sub?.status === "active";
        } catch {
          token.isPro = false;
        }
      }
      return token;
    }
  },
})
