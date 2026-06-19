import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      isAdmin?: boolean;
      isPro?: boolean;
      isPremium?: boolean;
      plan?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
    isPro?: boolean;
    isPremium?: boolean;
    plan?: string;
  }
}
