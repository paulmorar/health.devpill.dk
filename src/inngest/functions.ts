/**
 * Inngest functions that react to Strava webhook events.
 *
 * The webhook endpoint (`/api/strava/webhook`) acknowledges Strava with a 200
 * immediately and forwards the work here. Inngest gives us at-least-once
 * delivery, automatic retries with exponential backoff, and a UI to inspect
 * failures — which Strava's "we'll retry a few times and give up" policy
 * does not.
 */
import {
  fetchActivityById,
  fetchAthleteActivities,
  getValidAccessToken,
} from "@/lib/strava";
import {
  deleteStravaActivity,
  upsertStravaActivities,
} from "@/db/strava-activities";
import { db } from "@/db";
import { stravaConnections } from "@/db/schema";
import { inngest } from "./client";

export const syncStravaActivity = inngest.createFunction(
  {
    id: "strava-sync-activity",
    retries: 4,
    concurrency: { limit: 5 },
    triggers: [{ event: "strava/activity.sync" }],
  },
  async ({ event, step }) => {
    const { userId, activityId } = event.data;

    const accessToken = await step.run("get-token", () =>
      getValidAccessToken(userId),
    );

    const activity = await step.run("fetch-activity", () =>
      fetchActivityById(accessToken, activityId),
    );

    if (!activity) {
      // 404 — likely deleted between webhook and fetch. Tidy up if we had it.
      await step.run("cleanup-missing", () =>
        deleteStravaActivity(userId, activityId),
      );
      return { status: "not_found" as const, activityId };
    }

    await step.run("upsert", () => upsertStravaActivities(userId, [activity]));

    return { status: "ok" as const, activityId };
  },
);

export const deleteStravaActivityFn = inngest.createFunction(
  {
    id: "strava-delete-activity",
    retries: 3,
    triggers: [{ event: "strava/activity.delete" }],
  },
  async ({ event, step }) => {
    const { userId, activityId } = event.data;
    await step.run("delete", () => deleteStravaActivity(userId, activityId));
    return { status: "deleted" as const, activityId };
  },
);

// ─── Cron fallback ───────────────────────────────────────────────
// Strava webhooks are best-effort. If our endpoint is briefly down, Strava
// retries a couple of times then drops the event. This scheduled job pulls
// recent activities for every connected user so anything missed gets
// reconciled within the cron interval.

const DEFAULT_HOURS_BACK = 36;

export const cronSyncRecentStrava = inngest.createFunction(
  {
    id: "strava-cron-sync-recent",
    // Every 6h. Adjust if you want tighter SLA.
    triggers: [{ cron: "0 */6 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("list-connections", async () => {
      const rows = await db
        .select({ userId: stravaConnections.userId })
        .from(stravaConnections);
      return rows.map((r) => r.userId);
    });

    if (userIds.length === 0) {
      return { fannedOut: 0 };
    }

    // Fan out one event per user so per-user work runs in parallel under the
    // existing concurrency limits and individual failures don't block others.
    await step.sendEvent(
      "fanout-user-sync",
      userIds.map((userId) => ({
        name: "strava/user.sync-recent" as const,
        data: { userId },
      })),
    );

    return { fannedOut: userIds.length };
  },
);

export const syncRecentForUser = inngest.createFunction(
  {
    id: "strava-sync-recent-user",
    retries: 3,
    // One concurrent run per user — avoids burning Strava rate limit if the
    // cron overlaps with a still-running previous tick for the same user.
    concurrency: { limit: 1, key: "event.data.userId" },
    triggers: [{ event: "strava/user.sync-recent" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data;
    const hoursBack = event.data.hoursBack ?? DEFAULT_HOURS_BACK;

    const accessToken = await step.run("get-token", () =>
      getValidAccessToken(userId),
    );

    const after = Math.floor(Date.now() / 1000) - hoursBack * 3600;

    const activities = await step.run("fetch-recent", () =>
      fetchAthleteActivities(accessToken, { after }),
    );

    if (activities.length === 0) {
      return { status: "ok" as const, count: 0 };
    }

    await step.run("upsert", () => upsertStravaActivities(userId, activities));

    return { status: "ok" as const, count: activities.length };
  },
);

export const functions = [
  syncStravaActivity,
  deleteStravaActivityFn,
  cronSyncRecentStrava,
  syncRecentForUser,
];
