import { desc, eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { activities, stravaConnections } from "@/db/schema";
import {
  connectStravaAction,
  disconnectStravaAction,
} from "@/app/_actions/strava";
import { BackfillButton } from "@/app/_components/backfill-button";

type SearchParams = Promise<{
  strava_connected?: string;
  strava_error?: string;
}>;

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You denied access on Strava.",
  state_mismatch: "Security check failed. Please try again.",
  missing_params: "Strava did not return the expected parameters.",
  missing_scope: "Please grant access to activities.",
  token_exchange_failed: "Could not exchange the Strava code for a token.",
};

// ── Formatting helpers ─────────────────────────────────────────────
// One-off and locale-pinned so SSR matches client (no hydration warnings).

function formatDistance(meters: number | null): string | null {
  if (meters == null) return null;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const userId = session?.user?.id;

  const [connection, recentActivities] = userId
    ? await Promise.all([
        db
          .select()
          .from(stravaConnections)
          .where(eq(stravaConnections.userId, userId))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select()
          .from(activities)
          .where(eq(activities.userId, userId))
          .orderBy(desc(activities.startedAt))
          .limit(25),
      ])
    : [undefined, [] as (typeof activities.$inferSelect)[]];

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 p-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Logged in as{" "}
            <span className="font-medium">{session?.user?.email}</span>
          </p>
        </header>

        {params.strava_error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {ERROR_MESSAGES[params.strava_error] ??
              `Strava error: ${params.strava_error}`}
          </div>
        )}
        {params.strava_connected && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            Strava connected.
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Strava
          </h2>

          {connection ? (
            <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm">
                Connected as{" "}
                <span className="font-medium">
                  {connection.athleteFirstname} {connection.athleteLastname}
                </span>
                {connection.athleteUsername && (
                  <span className="text-zinc-500">
                    {" "}
                    (@{connection.athleteUsername})
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                Scope: <code>{connection.scope}</code>
              </p>
              <BackfillButton />
              <form action={disconnectStravaAction}>
                <button
                  type="submit"
                  className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  Disconnect
                </button>
              </form>
            </div>
          ) : (
            <form action={connectStravaAction}>
              <button
                type="submit"
                className="h-10 w-full rounded-lg bg-[#fc4c02] px-4 text-sm font-medium text-white transition-colors hover:bg-[#e34502]"
              >
                Connect Strava
              </button>
            </form>
          )}
        </section>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>

      {connection && (
        <section className="w-full max-w-md space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recent activities
          </h2>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No activities yet. Click &ldquo;Backfill last 30 days&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {recentActivities.map((a) => {
                const distance = formatDistance(a.distanceM);
                const duration = formatDuration(a.movingSeconds);
                return (
                  <li key={a.id} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        {a.name ?? a.sportType}
                      </p>
                      <p className="shrink-0 text-xs text-zinc-500">
                        {formatDate(a.startedAt)}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {a.sportType}
                      {distance && ` · ${distance}`}
                      {duration && ` · ${duration}`}
                      {a.avgHr != null && ` · ${a.avgHr} bpm`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
