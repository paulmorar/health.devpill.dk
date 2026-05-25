/**
 * Database schema for health.devpill.dk
 *
 * Phase 0 includes only Auth.js tables. Domain tables (activities,
 * wellness_entries, foods, food_entries, goals) are added in later phases.
 *
 * Naming: TypeScript camelCase, mapped to snake_case in Postgres via
 * `casing: "snake_case"` in drizzle.config.ts and the client.
 */
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ─── Auth.js tables ──────────────────────────────────────────────
// Schema follows the official Auth.js + Drizzle adapter reference:
// https://authjs.dev/getting-started/adapters/drizzle

export const users = pgTable("users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text(),
  email: text().unique(),
  emailVerified: timestamp({ mode: "date" }),
  image: text(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().$type<AdapterAccountType>().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refreshToken: text(),
    accessToken: text(),
    expiresAt: integer(),
    tokenType: text(),
    scope: text(),
    idToken: text(),
    sessionState: text(),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp({ mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);
