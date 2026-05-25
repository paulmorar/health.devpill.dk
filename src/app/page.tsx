import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import {
  activities,
  foodLogs,
  goals,
  stravaConnections,
  wellnessLogs,
} from "@/db/schema";
import {
  connectStravaAction,
  disconnectStravaAction,
} from "@/app/_actions/strava";
import { deleteFoodLogAction } from "@/app/_actions/health";
import { BackfillButton } from "@/app/_components/backfill-button";
import { FoodLogForm } from "@/app/_components/food-log-form";
import {
  WellnessLogForm,
  type WellnessInitial,
} from "@/app/_components/wellness-log-form";
import { GoalsForm, type GoalsInitial } from "@/app/_components/goals-form";
import { ProgressBar } from "@/app/_components/progress-bar";
import { Sparkline } from "@/app/_components/sparkline";

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

function formatTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// Today bounds — UTC. We don't yet track per-user timezone; rolling 24h windows
// shown as UTC is fine for a personal app while everything is in one tz.
function utcDayBounds(now: Date = new Date()): {
  start: Date;
  end: Date;
  isoDate: string;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  const isoDate = start.toISOString().slice(0, 10);
  return { start, end, isoDate };
}

// ISO week (Mon → Sun) in UTC.
function utcWeekBounds(now: Date = new Date()): { start: Date; end: Date } {
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = (day + 6) % 7; // days since Monday
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      mondayOffset * 24 * 60 * 60 * 1000,
  );
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

// Build an array of length `days` aligned to today (UTC), filling in a value
// for each ISO day from a sparse map. Returned chronologically (oldest first).
function alignSeries<T>(
  rows: Array<{ date: string } & T>,
  pick: (r: T) => number | null,
  days: number,
  todayIso: string,
): Array<number | null> {
  const byDate = new Map(rows.map((r) => [r.date, pick(r)]));
  const out: Array<number | null> = [];
  const today = new Date(`${todayIso}T00:00:00Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().slice(0, 10);
    out.push(byDate.get(iso) ?? null);
  }
  return out;
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const userId = session?.user?.id;

  const { start: dayStart, end: dayEnd, isoDate: today } = utcDayBounds();
  const { start: weekStart, end: weekEnd } = utcWeekBounds();
  // 14-day trend window — includes today.
  const trendStart = new Date(
    new Date(`${today}T00:00:00Z`).getTime() - 13 * 24 * 60 * 60 * 1000,
  );
  const trendStartIso = trendStart.toISOString().slice(0, 10);

  const [
    connection,
    recentActivities,
    todaysFood,
    wellnessToday,
    weekActivities,
    trendWellness,
    userGoals,
  ] = userId
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
        db
          .select()
          .from(foodLogs)
          .where(
            and(
              eq(foodLogs.userId, userId),
              gte(foodLogs.consumedAt, dayStart),
              lte(foodLogs.consumedAt, dayEnd),
            ),
          )
          .orderBy(desc(foodLogs.consumedAt)),
        db
          .select()
          .from(wellnessLogs)
          .where(
            and(eq(wellnessLogs.userId, userId), eq(wellnessLogs.date, today)),
          )
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select()
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startedAt, weekStart),
              lte(activities.startedAt, weekEnd),
            ),
          ),
        db
          .select()
          .from(wellnessLogs)
          .where(
            and(
              eq(wellnessLogs.userId, userId),
              gte(wellnessLogs.date, trendStartIso),
              lte(wellnessLogs.date, today),
            ),
          )
          .orderBy(asc(wellnessLogs.date)),
        db
          .select()
          .from(goals)
          .where(eq(goals.userId, userId))
          .limit(1)
          .then((rows) => rows[0]),
      ])
    : [
        undefined,
        [] as (typeof activities.$inferSelect)[],
        [] as (typeof foodLogs.$inferSelect)[],
        undefined,
        [] as (typeof activities.$inferSelect)[],
        [] as (typeof wellnessLogs.$inferSelect)[],
        undefined,
      ];

  const totals = todaysFood.reduce(
    (acc, f) => ({
      kcal: acc.kcal + (f.kcal ?? 0),
      proteinG: acc.proteinG + (f.proteinG ?? 0),
      carbsG: acc.carbsG + (f.carbsG ?? 0),
      fatG: acc.fatG + (f.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const wellnessInitial: WellnessInitial = {
    date: today,
    weightKg: wellnessToday?.weightKg ?? null,
    sleepHours: wellnessToday?.sleepHours ?? null,
    sleepScore: wellnessToday?.sleepScore ?? null,
    vo2max: wellnessToday?.vo2max ?? null,
    mood: wellnessToday?.mood ?? null,
    energy: wellnessToday?.energy ?? null,
    notes: wellnessToday?.notes ?? null,
  };

  const goalsInitial: GoalsInitial = {
    dailyKcal: userGoals?.dailyKcal ?? null,
    dailyProteinG: userGoals?.dailyProteinG ?? null,
    dailyCarbsG: userGoals?.dailyCarbsG ?? null,
    dailyFatG: userGoals?.dailyFatG ?? null,
    weeklyActiveKm: userGoals?.weeklyActiveKm ?? null,
    weeklyActiveMinutes: userGoals?.weeklyActiveMinutes ?? null,
    weeklyActivitiesCount: userGoals?.weeklyActivitiesCount ?? null,
    targetWeightKg: userGoals?.targetWeightKg ?? null,
    dailySleepHours: userGoals?.dailySleepHours ?? null,
  };

  // Weekly activity rollups (Mon→Sun UTC).
  const weekTotals = weekActivities.reduce(
    (acc, a) => ({
      km: acc.km + (a.distanceM ?? 0) / 1000,
      minutes: acc.minutes + Math.round((a.movingSeconds ?? 0) / 60),
      count: acc.count + 1,
      kcal: acc.kcal + (a.calories ?? 0),
    }),
    { km: 0, minutes: 0, count: 0, kcal: 0 },
  );

  // 14-day trend series, aligned to UTC day grid (oldest → today).
  const trendRows = trendWellness.map((w) => ({
    date: w.date,
    weightKg: w.weightKg,
    sleepHours: w.sleepHours,
  }));
  const weightSeries = alignSeries(trendRows, (r) => r.weightKg, 14, today);
  const sleepSeries = alignSeries(trendRows, (r) => r.sleepHours, 14, today);
  const hasTrendData =
    weightSeries.some((v) => v != null) || sleepSeries.some((v) => v != null);

  const cardCls =
    "w-full max-w-md space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
  const sectionTitle =
    "text-sm font-semibold uppercase tracking-wide text-zinc-500";

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
          <h2 className={sectionTitle}>Strava</h2>

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

      {userId && (
        <section className={cardCls}>
          <h2 className={sectionTitle}>Today (totals)</h2>
          <div className="space-y-2">
            <ProgressBar
              label="kcal"
              current={totals.kcal}
              goal={goalsInitial.dailyKcal}
            />
            <ProgressBar
              label="Protein"
              current={totals.proteinG}
              goal={goalsInitial.dailyProteinG}
              unit="g"
            />
            <ProgressBar
              label="Carbs"
              current={totals.carbsG}
              goal={goalsInitial.dailyCarbsG}
              unit="g"
            />
            <ProgressBar
              label="Fat"
              current={totals.fatG}
              goal={goalsInitial.dailyFatG}
              unit="g"
            />
          </div>
        </section>
      )}

      {userId && (
        <section className={cardCls}>
          <h2 className={sectionTitle}>This week</h2>
          <div className="space-y-2">
            <ProgressBar
              label="Distance"
              current={weekTotals.km}
              goal={goalsInitial.weeklyActiveKm}
              unit=" km"
              fractionDigits={1}
            />
            <ProgressBar
              label="Active minutes"
              current={weekTotals.minutes}
              goal={goalsInitial.weeklyActiveMinutes}
            />
            <ProgressBar
              label="Activities"
              current={weekTotals.count}
              goal={goalsInitial.weeklyActivitiesCount}
            />
            {weekTotals.kcal > 0 && (
              <ProgressBar
                label="Activity kcal"
                current={weekTotals.kcal}
                goal={null}
              />
            )}
          </div>
        </section>
      )}

      {userId && hasTrendData && (
        <section className={cardCls}>
          <h2 className={sectionTitle}>Trends (14 days)</h2>
          <div className="space-y-4">
            <Sparkline
              label="Weight"
              values={weightSeries}
              unit=" kg"
              fractionDigits={1}
            />
            <Sparkline
              label="Sleep"
              values={sleepSeries}
              unit=" h"
              fractionDigits={1}
            />
          </div>
        </section>
      )}

      {userId && (
        <section className={cardCls}>
          <details>
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Goals
            </summary>
            <div className="mt-3">
              <GoalsForm initial={goalsInitial} />
            </div>
          </details>
        </section>
      )}

      {userId && (
        <section className={cardCls}>
          <h2 className={sectionTitle}>Wellness today</h2>
          <WellnessLogForm initial={wellnessInitial} />
        </section>
      )}

      {userId && (
        <section className={cardCls}>
          <h2 className={sectionTitle}>Log food</h2>
          <FoodLogForm />
        </section>
      )}

      {userId && todaysFood.length > 0 && (
        <section className={cardCls}>
          <h2 className={sectionTitle}>Food today</h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {todaysFood.map((f) => (
              <li
                key={f.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {f.name}
                    {f.brand && (
                      <span className="text-zinc-500"> · {f.brand}</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatTime(f.consumedAt)} · {f.servingGrams}g ·{" "}
                    {Math.round(f.kcal)} kcal
                    {f.proteinG != null && ` · P ${Math.round(f.proteinG)}g`}
                    {f.carbsG != null && ` · C ${Math.round(f.carbsG)}g`}
                    {f.fatG != null && ` · F ${Math.round(f.fatG)}g`}
                  </p>
                </div>
                <form action={deleteFoodLogAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    type="submit"
                    className="text-xs text-zinc-500 hover:text-red-600"
                    aria-label="Delete entry"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {connection && (
        <section className={cardCls}>
          <h2 className={sectionTitle}>Recent activities</h2>
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
