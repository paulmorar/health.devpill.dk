/**
 * Auth.js v5 configuration.
 *
 * - GitHub OAuth as the only provider in Phase 0
 * - Drizzle adapter writes to Neon Postgres
 * - Database-backed sessions
 * - Hardcoded email allowlist gates who may sign in
 *
 * Resend magic-link provider will be added in a later phase.
 */
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (allowedEmails.length === 0) {
        // Fail closed: an empty allowlist means nobody can sign in.
        console.warn("[auth] AUTH_ALLOWED_EMAILS is empty; refusing sign-in");
        return false;
      }
      return allowedEmails.includes(email);
    },
  },
  pages: {
    signIn: "/signin",
  },
});
