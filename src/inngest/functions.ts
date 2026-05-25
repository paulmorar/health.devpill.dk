/**
 * Inngest functions that react to Strava webhook events.
 *
 * The webhook endpoint (`/api/strava/webhook`) acknowledges Strava with a 200
 * immediately and forwards the work here. Inngest gives us at-least-once
 * delivery, automatic retries with exponential backoff, and a UI to inspect
 * failures — which Strava's "we'll retry a few times and give up" policy
 * does not.
 */
import { fetchActivityById, getValidAccessToken } from "@/lib/strava";
import {
  deleteStravaActivity,
  upsertStravaActivities,
} from "@/db/strava-activities";
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

export const functions = [syncStravaActivity, deleteStravaActivityFn];
