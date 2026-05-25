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
  bigint,
  jsonb,
  index,
  uniqueIndex,
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
    // The Auth.js Drizzle adapter's types require these exact snake_case
    // property names on the accounts table. The DB column names are the
    // same either way (`casing: "snake_case"` is a no-op here), so this
    // change is type-only.
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
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

// ─── Strava connection (data source, not auth provider) ──────────
// One row per user. Holds the OAuth tokens we use to call the Strava API
// on the user's behalf. Tokens are short-lived (6h access, long-lived refresh).
export const stravaConnections = pgTable("strava_connections", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  athleteId: bigint({ mode: "number" }).notNull().unique(),
  accessToken: text().notNull(),
  refreshToken: text().notNull(),
  expiresAt: timestamp({ mode: "date" }).notNull(),
  scope: text().notNull(),
  athleteFirstname: text(),
  athleteLastname: text(),
  athleteUsername: text(),
  athleteProfile: text(),
  connectedAt: timestamp({ mode: "date" }).defaultNow().notNull(),
});

// ─── Strava activity raw payload ─────────────────────────────────
// Verbatim JSON from Strava's `/athlete/activities` (and later detail/webhook)
// responses. We keep this so we can re-derive `activities` rows without
// re-fetching from Strava if our normalization logic changes.
export const stravaActivitiesRaw = pgTable(
  "strava_activities_raw",
  {
    stravaId: bigint({ mode: "number" }).primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    payload: jsonb().notNull(),
    fetchedAt: timestamp({ mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("strava_activities_raw_user_idx").on(t.userId)],
);

// ─── Normalized activities ───────────────────────────────────────
// One row per activity. Source-agnostic shape so we can later mix in
// manual entries or other providers without schema churn.
export const activities = pgTable(
  "activities",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text().notNull(), // "strava" for now
    sourceId: text().notNull(), // stringified strava activity id
    sportType: text().notNull(), // strava sport_type (Run, Ride, Walk, …)
    name: text(),
    startedAt: timestamp({ mode: "date", withTimezone: true }).notNull(),
    timezone: text(),
    distanceM: integer(),
    movingSeconds: integer(),
    elapsedSeconds: integer(),
    elevationGainM: integer(),
    calories: integer(),
    avgHr: integer(),
    maxHr: integer(),
    createdAt: timestamp({ mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp({ mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("activities_user_started_idx").on(t.userId, t.startedAt),
    // A given source can only contribute each external id once per user.
    uniqueIndex("activities_source_unique_idx").on(
      t.userId,
      t.source,
      t.sourceId,
    ),
  ],
);
