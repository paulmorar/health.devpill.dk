/**
 * Strava push subscription endpoint.
 *
 * GET — verification handshake. Strava calls this once when the subscription
 *   is created with `hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`.
 *   We must echo back `{"hub.challenge": <challenge>}` if the verify token
 *   matches `STRAVA_WEBHOOK_VERIFY_TOKEN`, otherwise return 403.
 *
 * POST — event delivery. Strava sends `{object_type, object_id, aspect_type,
 *   owner_id, event_time, …}` per change. We ack with 200 immediately and
 *   hand the work off to Inngest. Strava expects a response within 2s and
 *   does not retry on our failures, which is why durable execution matters.
 *
 * See https://developers.strava.com/docs/webhooks/
 */
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stravaConnections } from "@/db/schema";
import { inngest } from "@/inngest/client";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");

  if (mode !== "subscribe" || !challenge) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (token !== requireEnv("STRAVA_WEBHOOK_VERIFY_TOKEN")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ "hub.challenge": challenge });
}

// Strava sends slightly different fields per object_type / aspect_type.
// We only care about activity events; athlete deauthorization arrives as
// object_type="athlete", aspect_type="update", updates={authorized:"false"}.
const eventSchema = z.object({
  object_type: z.enum(["activity", "athlete"]),
  object_id: z.number(),
  aspect_type: z.enum(["create", "update", "delete"]),
  owner_id: z.number(), // Strava athlete id
  event_time: z.number(),
  subscription_id: z.number(),
  updates: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  let event: z.infer<typeof eventSchema>;
  try {
    event = eventSchema.parse(await req.json());
  } catch {
    // Malformed payload — ack so Strava doesn't hammer us, but log.
    console.error("[strava webhook] malformed payload");
    return NextResponse.json({ ok: true });
  }

  // Resolve owner_id (athlete) → our userId. Drop the event if we don't
  // know the athlete (could be a leftover from a previously-disconnected
  // account whose subscription hasn't been cleaned up).
  const connection = (
    await db
      .select({ userId: stravaConnections.userId })
      .from(stravaConnections)
      .where(eq(stravaConnections.athleteId, event.owner_id))
      .limit(1)
  )[0];

  if (!connection) {
    console.warn(
      `[strava webhook] no connection for athlete ${event.owner_id}`,
    );
    return NextResponse.json({ ok: true });
  }

  if (event.object_type === "athlete") {
    // Deauthorization: drop our tokens. The user can re-connect anytime.
    if (event.updates?.authorized === "false") {
      await db
        .delete(stravaConnections)
        .where(eq(stravaConnections.userId, connection.userId));
    }
    return NextResponse.json({ ok: true });
  }

  // object_type === "activity"
  if (event.aspect_type === "delete") {
    await inngest.send({
      name: "strava/activity.delete",
      data: { userId: connection.userId, activityId: event.object_id },
    });
  } else {
    await inngest.send({
      name: "strava/activity.sync",
      data: {
        userId: connection.userId,
        activityId: event.object_id,
        aspect: event.aspect_type,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
