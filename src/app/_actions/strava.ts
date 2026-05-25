/**
 * Server actions for connecting and disconnecting a Strava account.
 *
 * - `connectStravaAction` mints a CSRF-defense `state` token, persists it in
 *   a short-lived httpOnly cookie, and redirects the user to Strava's
 *   authorize page.
 * - `disconnectStravaAction` deletes the user's row from
 *   `strava_connections`. (Strava itself still considers the app authorized
 *   until the user revokes it from their Strava settings, but we drop the
 *   tokens so the app can no longer act on their behalf.)
 */
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { stravaConnections } from "@/db/schema";
import { upsertStravaActivities } from "@/db/strava-activities";
import {
  buildAuthorizeUrl,
  fetchAthleteActivities,
  getValidAccessToken,
  STRAVA_STATE_COOKIE,
  type StravaSummaryActivity,
} from "@/lib/strava";

export async function connectStravaAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  // 32-byte random hex token. Round-trips via Strava's `state` param and
  // is verified against the cookie on callback.
  const state = crypto
    .getRandomValues(new Uint8Array(32))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

  const cookieStore = await cookies();
  cookieStore.set(STRAVA_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes is plenty for the OAuth round-trip
    path: "/",
  });

  redirect(buildAuthorizeUrl(state));
}

export async function disconnectStravaAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  await db
    .delete(stravaConnections)
    .where(eq(stravaConnections.userId, session!.user!.id!));
  redirect("/");
}

/**
 * Pull the user's last 30 days of Strava activities into our DB.
 *
 * Writes the raw payload to `strava_activities_raw` (for re-derivation later)
 * and a normalized row to `activities`. Both are idempotent — running it
 * twice will not produce duplicates.
 *
 * Returns a result tuple so the calling form can show "Imported N activities"
 * without throwing on the happy path.
 */
export async function backfillStravaAction(): Promise<
  | {
      ok: true;
      imported: number;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthenticated" };
  }
  const userId = session.user.id;

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(userId);
  } catch {
    return { ok: false, error: "no_strava_connection" };
  }

  const thirtyDaysAgoSec = Math.floor(
    (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000,
  );

  let fetched: StravaSummaryActivity[];
  try {
    fetched = await fetchAthleteActivities(accessToken, {
      after: thirtyDaysAgoSec,
    });
  } catch {
    return { ok: false, error: "fetch_failed" };
  }

  if (fetched.length === 0) {
    revalidatePath("/");
    return { ok: true, imported: 0 };
  }

  await upsertStravaActivities(userId, fetched);

  revalidatePath("/");
  return { ok: true, imported: fetched.length };
}
