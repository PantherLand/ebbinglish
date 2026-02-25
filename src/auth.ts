import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/src/prisma";

const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
const isLocalAuthUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(authUrl);
const trustHost = process.env.AUTH_TRUST_HOST === "true" || isLocalAuthUrl;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Avoid runtime OIDC discovery fetch to reduce startup/sign-in failures
      // when Google discovery endpoint is not reachable from local network.
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
    }),
  ],
  // Middleware runs on Edge runtime; DB session strategy would call Prisma there.
  // Use JWT sessions so auth checks in middleware don't require database access.
  session: { strategy: "jwt" },
});
