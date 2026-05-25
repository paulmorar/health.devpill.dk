/**
 * Persistence helpers for Strava activities.
 *
 * Shared between the manual backfill server action and the Inngest
 * webhook-driven sync job. Keeps insert/update SQL in one place so the two
 * codepaths can never drift.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, stravaActivitiesRaw } from "@/db/schema";
import type { StravaSummaryActivity } from "@/lib/strava";

/**
 * Upsert one or more Strava activities into both `strava_activities_raw`
 * (verbatim payload) and `activities` (normalized). Safe to run repeatedly.
 *
 * No-op when `items` is empty.
 */
export async function upsertStravaActivities(
  userId: string,
  items: StravaSummaryActivity[],
): Promise<void> {
  if (items.length === 0) return;

  await db
    .insert(stravaActivitiesRaw)
    .values(
      items.map((a) => ({
        stravaId: a.id,
        userId,
        payload: a as unknown as Record<string, unknown>,
      })),
    )
    .onConflictDoUpdate({
      target: stravaActivitiesRaw.stravaId,
      set: {
        payload: sql`excluded.payload`,
        fetchedAt: sql`now()`,
      },
    });

  await db
    .insert(activities)
    .values(
      items.map((a) => ({
        userId,
        source: "strava",
        sourceId: String(a.id),
        sportType: a.sport_type,
        name: a.name ?? null,
        startedAt: new Date(a.start_date),
        timezone: a.timezone ?? null,
        distanceM: a.distance != null ? Math.round(a.distance) : null,
        movingSeconds: a.moving_time != null ? Math.round(a.moving_time) : null,
        elapsedSeconds:
          a.elapsed_time != null ? Math.round(a.elapsed_time) : null,
        elevationGainM:
          a.total_elevation_gain != null
            ? Math.round(a.total_elevation_gain)
            : null,
        calories: a.calories != null ? Math.round(a.calories) : null,
        avgHr:
          a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
        maxHr: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
      })),
    )
    .onConflictDoUpdate({
      target: [activities.userId, activities.source, activities.sourceId],
      set: {
        sportType: sql`excluded.sport_type`,
        name: sql`excluded.name`,
        startedAt: sql`excluded.started_at`,
        timezone: sql`excluded.timezone`,
        distanceM: sql`excluded.distance_m`,
        movingSeconds: sql`excluded.moving_seconds`,
        elapsedSeconds: sql`excluded.elapsed_seconds`,
        elevationGainM: sql`excluded.elevation_gain_m`,
        calories: sql`excluded.calories`,
        avgHr: sql`excluded.avg_hr`,
        maxHr: sql`excluded.max_hr`,
        updatedAt: sql`now()`,
      },
    });
}

/**
 * Delete a single activity (raw + normalized) for a user. Used when Strava
 * sends a webhook `aspect_type: "delete"` event.
 */
export async function deleteStravaActivity(
  userId: string,
  stravaId: number,
): Promise<void> {
  await db
    .delete(activities)
    .where(
      and(
        eq(activities.userId, userId),
        eq(activities.source, "strava"),
        eq(activities.sourceId, String(stravaId)),
      ),
    );
  await db
    .delete(stravaActivitiesRaw)
    .where(eq(stravaActivitiesRaw.stravaId, stravaId));
}
