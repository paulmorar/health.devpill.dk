/**
 * Inngest client. One instance per process.
 *
 * The `id` here is the app id Inngest uses to namespace functions. The event
 * key + signing key are picked up from `INNGEST_EVENT_KEY` /
 * `INNGEST_SIGNING_KEY` automatically in production. In local dev, the
 * Inngest Dev Server (started with `npx inngest-cli@latest dev`) replaces
 * those and discovers functions by polling `/api/inngest`.
 */
import { Inngest } from "inngest";

// ── Event payload types ───────────────────────────────────────────
// We pass these to `Inngest<...>` so `inngest.send()` is typed; it's
// equivalent to the EventSchemas helper but avoids a v4 SDK quirk where
// Turbopack picks the wrong re-export of that class.

export type AppEvents = {
  "strava/activity.sync": {
    name: "strava/activity.sync";
    data: {
      /** App user id (NOT Strava athlete id). */
      userId: string;
      /** Strava activity id. */
      activityId: number;
      /** "create" or "update". Deletes use a separate event. */
      aspect: "create" | "update";
    };
  };
  "strava/activity.delete": {
    name: "strava/activity.delete";
    data: {
      userId: string;
      activityId: number;
    };
  };
};

export const inngest = new Inngest<{
  id: "health-devpill-dk";
  events: AppEvents;
}>({
  id: "health-devpill-dk",
  // Use the Inngest Dev Server (http://localhost:8288) locally; switch to
  // cloud mode only when deployed to Vercel where INNGEST_SIGNING_KEY exists.
  isDev: process.env.NODE_ENV !== "production",
});
