/**
 * Strava API helpers.
 *
 * Phase 1a: OAuth (authorize URL, token exchange).
 * Phase 1b: token refresh + activity fetching.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stravaConnections } from "@/db/schema";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

// Scopes we request from Strava. `read` is implicit; `activity:read_all`
// gives access to private activities too, which the user almost certainly
// wants for a personal dashboard.
export const STRAVA_SCOPES = ["read", "activity:read_all"] as const;

// Name of the short-lived cookie that round-trips the OAuth `state` token
// between `connectStravaAction` and the OAuth callback (CSRF defense).
export const STRAVA_STATE_COOKIE = "strava_oauth_state";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function stravaConfig() {
  return {
    clientId: requireEnv("STRAVA_CLIENT_ID"),
    clientSecret: requireEnv("STRAVA_CLIENT_SECRET"),
    redirectUri: `${requireEnv("AUTH_URL")}/api/strava/callback`,
  };
}

/**
 * Build the URL the user is redirected to in order to authorize the app.
 * `state` should be an opaque, unguessable token bound to the user's session
 * so we can verify it on the callback (CSRF defense).
 */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = stravaConfig();
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", STRAVA_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

// Shape of the token response, validated with Zod. Strava returns more fields;
// we ignore the ones we don't need yet.
const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(), // unix seconds
  expires_in: z.number(),
  token_type: z.string(),
  athlete: z.object({
    id: z.number(),
    username: z.string().nullable().optional(),
    firstname: z.string().nullable().optional(),
    lastname: z.string().nullable().optional(),
    profile: z.string().nullable().optional(),
  }),
});

export type StravaTokenResponse = z.infer<typeof tokenResponseSchema>;

/**
 * Exchange an authorization code for an access/refresh token pair.
 * Throws on non-2xx responses or invalid shape.
 */
export async function exchangeCodeForToken(
  code: string,
): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = stravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token exchange failed: ${res.status} ${body}`);
  }
  return tokenResponseSchema.parse(await res.json());
}

// ─── Token refresh ────────────────────────────────────────────────
// Strava access tokens expire after 6h. The refresh endpoint returns the
// same shape minus `athlete`.
const refreshResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  expires_in: z.number(),
  token_type: z.string(),
});

/**
 * Returns a still-valid access token for the user, refreshing and persisting
 * the new pair if needed. Throws if the user has no Strava connection.
 *
 * Refresh ~1 minute before actual expiry to avoid races against in-flight
 * requests using an about-to-expire token.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const row = (
    await db
      .select()
      .from(stravaConnections)
      .where(eq(stravaConnections.userId, userId))
      .limit(1)
  )[0];
  if (!row) throw new Error("No Strava connection for user");

  const skewMs = 60_000;
  if (row.expiresAt.getTime() - skewMs > Date.now()) {
    return row.accessToken;
  }

  const { clientId, clientSecret } = stravaConfig();
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: row.refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${body}`);
  }
  const refreshed = refreshResponseSchema.parse(await res.json());
  await db
    .update(stravaConnections)
    .set({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(refreshed.expires_at * 1000),
    })
    .where(eq(stravaConnections.userId, userId));
  return refreshed.access_token;
}

// ─── Activity fetch ───────────────────────────────────────────────
// Minimal subset of the Strava SummaryActivity shape we care about.
// All fields besides id/type/start are optional because Strava omits them
// for some activity types (e.g. manual entries lack distance/calories).
const summaryActivitySchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  sport_type: z.string(),
  start_date: z.string(), // ISO 8601 UTC
  timezone: z.string().nullable().optional(),
  distance: z.number().nullable().optional(), // meters
  moving_time: z.number().nullable().optional(), // seconds
  elapsed_time: z.number().nullable().optional(),
  total_elevation_gain: z.number().nullable().optional(),
  calories: z.number().nullable().optional(),
  average_heartrate: z.number().nullable().optional(),
  max_heartrate: z.number().nullable().optional(),
});

export type StravaSummaryActivity = z.infer<typeof summaryActivitySchema>;

/**
 * Fetch all athlete activities started at-or-after `after` (a unix-seconds
 * epoch), paging through Strava's 200-per-page endpoint until exhausted.
 *
 * Strava rate limits to 200 req/15min and 2000/day — for a 30-day backfill
 * of a normal hobbyist account this is at most a couple of pages.
 */
export async function fetchAthleteActivities(
  accessToken: string,
  opts: { after: number; perPage?: number; maxPages?: number },
): Promise<StravaSummaryActivity[]> {
  const perPage = opts.perPage ?? 200;
  const maxPages = opts.maxPages ?? 10;
  const all: StravaSummaryActivity[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
    url.searchParams.set("after", String(opts.after));
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Strava activities fetch failed: ${res.status} ${body}`);
    }
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) {
      throw new Error("Strava activities response was not an array");
    }
    const parsed = z.array(summaryActivitySchema).parse(json);
    all.push(...parsed);
    if (parsed.length < perPage) break;
  }

  return all;
}

/**
 * Fetch a single activity by its Strava id. Used by webhook handlers when
 * Strava notifies us of a `create` or `update` event for one activity.
 *
 * Returns `null` if Strava returns 404 (e.g. the activity was deleted
 * between the webhook firing and us fetching it).
 */
export async function fetchActivityById(
  accessToken: string,
  id: number,
): Promise<StravaSummaryActivity | null> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava activity fetch failed: ${res.status} ${body}`);
  }
  // The detail endpoint returns a superset of SummaryActivity; the schema
  // tolerates extra fields by default.
  return summaryActivitySchema.parse(await res.json());
}
