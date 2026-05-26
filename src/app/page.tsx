import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { auth, signIn, signOut } from "@/auth";
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
import { LineChart } from "@/app/_components/line-chart";
import { Tabs, type TabKey } from "@/app/_components/tabs";
import { DayNav } from "@/app/_components/day-nav";
import { Collapsible } from "@/app/_components/collapsible";
import {
  RangeSelector,
  type RangeDays,
} from "@/app/_components/range-selector";
import { CalorieHero } from "@/app/_components/calorie-hero";
import { MacroRing } from "@/app/_components/macro-ring";
import { ActivityCard } from "@/app/_components/activity-card";
import { InsightChips, type Chip } from "@/app/_components/insight-chips";
import { SportIcon } from "@/app/_components/sport-icon";

type SearchParams = Promise<{
  tab?: string;
  d?: string;
  range?: string;
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
// (Distance/duration formatters live next to <ActivityCard> now.)

function formatTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

// ── Date helpers ──────────────────────────────────────────────────

function utcDayBoundsFromIso(iso: string): { start: Date; end: Date } {
  const start = new Date(`${iso}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ISO week (Mon → Sun) in UTC.
function utcWeekBounds(now: Date = new Date()): { start: Date; end: Date } {
  const day = now.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      mondayOffset * 24 * 60 * 60 * 1000,
  );
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

// Align sparse [{date, ...}] rows to a contiguous N-day series ending today.
function alignSeries<T>(
  rows: Array<{ date: string } & T>,
  pick: (r: T) => number | null,
  days: number,
  todayIsoStr: string,
): Array<number | null> {
  const byDate = new Map(rows.map((r) => [r.date, pick(r)]));
  const out: Array<number | null> = [];
  const today = new Date(`${todayIsoStr}T00:00:00Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(byDate.get(d.toISOString().slice(0, 10)) ?? null);
  }
  return out;
}

function parseTab(v: string | undefined): TabKey {
  if (v === "trends" || v === "goals" || v === "account") return v;
  return "day";
}

function parseRange(v: string | undefined): RangeDays {
  if (v === "14") return 14;
  if (v === "90") return 90;
  return 30;
}

// ── Shared styles ─────────────────────────────────────────────────

const cardCls =
  "w-full max-w-md space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
const sectionTitle =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500";

// ─── Root ─────────────────────────────────────────────────────────

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-6">
        <div className={cardCls}>
          <h1 className="text-xl font-semibold tracking-tight">
            health.devpill.dk
          </h1>
          <p className="text-sm text-zinc-500">Sign in to continue.</p>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="h-10 w-full rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Sign in with GitHub
            </button>
          </form>
        </div>
      </main>
    );
  }

  const tab = parseTab(params.tab);
  const today = todayIso();
  const day =
    params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : today;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-stretch gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">
            health.devpill.dk
          </h1>
          <p className="truncate text-xs text-zinc-500">
            {session.user?.email}
          </p>
        </div>
      </header>

      <Tabs active={tab} />

      {(params.strava_error || params.strava_connected) && (
        <div className="space-y-2">
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
        </div>
      )}

      {tab === "day" && <DayTab userId={userId} day={day} />}
      {tab === "trends" && (
        <TrendsTab
          userId={userId}
          range={parseRange(params.range)}
          today={today}
        />
      )}
      {tab === "goals" && <GoalsTab userId={userId} />}
      {tab === "account" && (
        <AccountTab userId={userId} email={session.user?.email ?? null} />
      )}
    </main>
  );
}

// ─── Day tab ──────────────────────────────────────────────────────

async function DayTab({ userId, day }: { userId: string; day: string }) {
  const { start, end } = utcDayBoundsFromIso(day);

  // For insight chips: last 30 days of food (streak), this week's activities,
  // and the last few wellness rows to compute a weekly weight delta.
  const streakStart = new Date(start.getTime() - 30 * 86400000);
  const { start: weekStart, end: weekEnd } = utcWeekBounds(
    new Date(`${day}T12:00:00Z`),
  );

  const [
    dayFood,
    dayWellness,
    dayActivities,
    userGoals,
    streakFood,
    weekActivitiesForChips,
    recentWellness,
  ] = await Promise.all([
    db
      .select()
      .from(foodLogs)
      .where(
        and(
          eq(foodLogs.userId, userId),
          gte(foodLogs.consumedAt, start),
          lte(foodLogs.consumedAt, end),
        ),
      )
      .orderBy(desc(foodLogs.consumedAt)),
    db
      .select()
      .from(wellnessLogs)
      .where(and(eq(wellnessLogs.userId, userId), eq(wellnessLogs.date, day)))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          gte(activities.startedAt, start),
          lte(activities.startedAt, end),
        ),
      )
      .orderBy(desc(activities.startedAt)),
    db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ consumedAt: foodLogs.consumedAt })
      .from(foodLogs)
      .where(
        and(
          eq(foodLogs.userId, userId),
          gte(foodLogs.consumedAt, streakStart),
          lte(foodLogs.consumedAt, end),
        ),
      ),
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
          gte(wellnessLogs.date, isoDaysAgo(day, 30)),
          lte(wellnessLogs.date, day),
        ),
      )
      .orderBy(asc(wellnessLogs.date)),
  ]);

  const totals = dayFood.reduce(
    (acc, f) => ({
      kcal: acc.kcal + (f.kcal ?? 0),
      proteinG: acc.proteinG + (f.proteinG ?? 0),
      carbsG: acc.carbsG + (f.carbsG ?? 0),
      fatG: acc.fatG + (f.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const burnedKcal = dayActivities.reduce(
    (acc, a) => acc + (a.calories ?? 0),
    0,
  );

  const chips = computeInsightChips({
    refDay: day,
    streakFood: streakFood.map((r) => r.consumedAt),
    weekActivities: weekActivitiesForChips,
    recentWellness,
    targetWeightKg: userGoals?.targetWeightKg ?? null,
  });

  const wellnessInitial: WellnessInitial = {
    date: day,
    weightKg: dayWellness?.weightKg ?? null,
    sleepHours: dayWellness?.sleepHours ?? null,
    sleepScore: dayWellness?.sleepScore ?? null,
    vo2max: dayWellness?.vo2max ?? null,
    mood: dayWellness?.mood ?? null,
    energy: dayWellness?.energy ?? null,
    notes: dayWellness?.notes ?? null,
  };

  const hasWellness = !!dayWellness;

  return (
    <>
      <section className={cardCls}>
        <DayNav date={day} />
        {chips.length > 0 && <InsightChips chips={chips} />}
      </section>

      <section className={cardCls}>
        <CalorieHero
          consumed={totals.kcal}
          burned={burnedKcal}
          goal={userGoals?.dailyKcal ?? null}
        />
        <div className="mt-2 grid grid-cols-3 gap-2 pt-2">
          <MacroRing
            label="Protein"
            current={totals.proteinG}
            goal={userGoals?.dailyProteinG ?? null}
            tone="protein"
            overIsGood
          />
          <MacroRing
            label="Carbs"
            current={totals.carbsG}
            goal={userGoals?.dailyCarbsG ?? null}
            tone="carbs"
          />
          <MacroRing
            label="Fat"
            current={totals.fatG}
            goal={userGoals?.dailyFatG ?? null}
            tone="fat"
          />
        </div>
      </section>

      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>Wellness</h2>
          {hasWellness && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              logged
            </span>
          )}
        </div>
        {hasWellness && <WellnessSummary w={dayWellness} />}
        <Collapsible
          addLabel={hasWellness ? "Edit wellness" : "+ Add wellness"}
          variant={hasWellness ? "ghost" : "primary"}
        >
          <WellnessLogForm initial={wellnessInitial} />
        </Collapsible>
      </section>

      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>Food</h2>
          <span className="text-xs text-zinc-500">
            {dayFood.length} {dayFood.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <Collapsible addLabel="+ Add food">
          <FoodLogForm defaultDate={day} />
        </Collapsible>
        {dayFood.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            hint="Tap “Add food” above to start the day."
          />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {dayFood.map((f) => (
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
                    <span className="tabular-nums">
                      {formatTime(f.consumedAt)}
                    </span>{" "}
                    · {f.servingGrams}g ·{" "}
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {Math.round(f.kcal)} kcal
                    </span>
                    {f.proteinG != null && (
                      <span className="text-sky-600 dark:text-sky-400">
                        {" "}
                        · P {Math.round(f.proteinG)}g
                      </span>
                    )}
                    {f.carbsG != null && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}
                        · C {Math.round(f.carbsG)}g
                      </span>
                    )}
                    {f.fatG != null && (
                      <span className="text-pink-600 dark:text-pink-400">
                        {" "}
                        · F {Math.round(f.fatG)}g
                      </span>
                    )}
                  </p>
                </div>
                <form action={deleteFoodLogAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    type="submit"
                    className="rounded-md p-1 text-xs text-zinc-400 outline-none hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:hover:bg-rose-950/40"
                    aria-label="Delete entry"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>Activities</h2>
          {dayActivities.length > 0 && (
            <span className="text-xs text-zinc-500">
              {dayActivities.length}{" "}
              {dayActivities.length === 1 ? "session" : "sessions"}
            </span>
          )}
        </div>
        {dayActivities.length === 0 ? (
          <EmptyState
            title="Rest day"
            hint="No activities logged — recovery counts too."
            icon={<SportIcon sportType="rest" size={36} />}
          />
        ) : (
          <div className="space-y-2">
            {dayActivities.map((a) => (
              <ActivityCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ── Day-tab helpers ────────────────────────────────────────────────

function isoDaysAgo(refIso: string, n: number): string {
  const d = new Date(`${refIso}T00:00:00Z`);
  return new Date(d.getTime() - n * 86400000).toISOString().slice(0, 10);
}

function computeInsightChips({
  refDay,
  streakFood,
  weekActivities,
  recentWellness,
  targetWeightKg,
}: {
  refDay: string;
  streakFood: Date[];
  weekActivities: Array<typeof activities.$inferSelect>;
  recentWellness: Array<typeof wellnessLogs.$inferSelect>;
  targetWeightKg: number | null;
}): Chip[] {
  const out: Chip[] = [];

  // Streak: count consecutive UTC days ending at refDay that have ≥1 food log.
  const daySet = new Set(streakFood.map((d) => d.toISOString().slice(0, 10)));
  let streak = 0;
  let cursor = new Date(`${refDay}T00:00:00Z`);
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
    if (streak > 365) break; // safety
  }
  if (streak > 0) {
    out.push({
      icon: "🔥",
      value: `${streak}`,
      label: streak === 1 ? "day streak" : "day streak",
      tone: streak >= 3 ? "good" : "neutral",
    });
  }

  // Workouts this week
  if (weekActivities.length > 0) {
    out.push({
      icon: "💪",
      value: `${weekActivities.length}`,
      label:
        weekActivities.length === 1 ? "workout this wk" : "workouts this wk",
      tone: "good",
    });
  }

  // Weight delta vs ~7 days ago using the closest wellness entries.
  const weights = recentWellness
    .filter((w): w is typeof w & { weightKg: number } => w.weightKg != null)
    .map((w) => ({ date: w.date, kg: w.weightKg as number }));
  if (weights.length >= 2) {
    const latest = weights[weights.length - 1];
    const target =
      new Date(`${latest.date}T00:00:00Z`).getTime() - 7 * 86400000;
    // Pick the wellness entry closest to (but not after) 7 days before latest.
    let earlier = weights[0];
    for (const w of weights) {
      const t = new Date(`${w.date}T00:00:00Z`).getTime();
      if (t <= target) earlier = w;
    }
    if (earlier.date !== latest.date) {
      const delta = latest.kg - earlier.kg;
      const sign = delta > 0 ? "+" : "−";
      const tone: Chip["tone"] =
        targetWeightKg != null
          ? // moving toward target = good
            (targetWeightKg < latest.kg ? delta < 0 : delta > 0)
            ? "good"
            : delta === 0
              ? "neutral"
              : "warn"
          : "neutral";
      out.push({
        icon: "⚖️",
        value: `${sign}${Math.abs(delta).toFixed(1)} kg`,
        label: "vs last wk",
        tone,
      });
    }
  }

  return out;
}

function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      {icon}
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {title}
        </p>
        <p className="text-xs text-zinc-500">{hint}</p>
      </div>
    </div>
  );
}

function WellnessSummary({ w }: { w: typeof wellnessLogs.$inferSelect }) {
  const items: Array<{ label: string; value: string }> = [];
  if (w.weightKg != null)
    items.push({ label: "Weight", value: `${w.weightKg} kg` });
  if (w.sleepHours != null)
    items.push({ label: "Sleep", value: `${w.sleepHours} h` });
  if (w.sleepScore != null)
    items.push({ label: "Sleep score", value: `${w.sleepScore}` });
  if (w.vo2max != null) items.push({ label: "VO₂max", value: `${w.vo2max}` });
  if (w.mood != null) items.push({ label: "Mood", value: `${w.mood}/10` });
  if (w.energy != null)
    items.push({ label: "Energy", value: `${w.energy}/10` });
  if (items.length === 0 && !w.notes) return null;
  return (
    <dl className="grid grid-cols-3 gap-2 text-xs">
      {items.map((i) => (
        <div
          key={i.label}
          className="rounded-md border border-zinc-100 p-2 dark:border-zinc-900"
        >
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
            {i.label}
          </dt>
          <dd className="text-sm font-semibold">{i.value}</dd>
        </div>
      ))}
      {w.notes && (
        <p className="col-span-3 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {w.notes}
        </p>
      )}
    </dl>
  );
}

// ─── Trends tab ───────────────────────────────────────────────────

async function TrendsTab({
  userId,
  range,
  today,
}: {
  userId: string;
  range: RangeDays;
  today: string;
}) {
  const trendStart = new Date(
    new Date(`${today}T00:00:00Z`).getTime() - (range - 1) * 86400000,
  );
  const trendStartIso = trendStart.toISOString().slice(0, 10);

  const { start: weekStart, end: weekEnd } = utcWeekBounds();

  const [trendWellness, weekActivities, userGoals] = await Promise.all([
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
      .from(goals)
      .where(eq(goals.userId, userId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const trendRows = trendWellness.map((w) => ({
    date: w.date,
    weightKg: w.weightKg,
    sleepHours: w.sleepHours,
    sleepScore: w.sleepScore,
    vo2max: w.vo2max,
  }));

  const weight = alignSeries(trendRows, (r) => r.weightKg, range, today);
  const sleepHours = alignSeries(trendRows, (r) => r.sleepHours, range, today);
  const sleepScore = alignSeries(trendRows, (r) => r.sleepScore, range, today);
  const vo2max = alignSeries(trendRows, (r) => r.vo2max, range, today);

  const weekTotals = weekActivities.reduce(
    (acc, a) => ({
      km: acc.km + (a.distanceM ?? 0) / 1000,
      minutes: acc.minutes + Math.round((a.movingSeconds ?? 0) / 60),
      count: acc.count + 1,
      kcal: acc.kcal + (a.calories ?? 0),
    }),
    { km: 0, minutes: 0, count: 0, kcal: 0 },
  );

  const startLabel = formatShortDate(trendStartIso);
  const endLabel = formatShortDate(today);

  return (
    <>
      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>This week</h2>
          <span className="text-xs text-zinc-400">Mon → Sun</span>
        </div>
        <div className="space-y-2">
          <ProgressBar
            label="Distance"
            current={weekTotals.km}
            goal={userGoals?.weeklyActiveKm ?? null}
            unit=" km"
            fractionDigits={1}
            overIsGood
          />
          <ProgressBar
            label="Active minutes"
            current={weekTotals.minutes}
            goal={userGoals?.weeklyActiveMinutes ?? null}
            overIsGood
          />
          <ProgressBar
            label="Activities"
            current={weekTotals.count}
            goal={userGoals?.weeklyActivitiesCount ?? null}
            overIsGood
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

      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>Trends</h2>
          <RangeSelector active={range} />
        </div>
        <div className="space-y-6 pt-1">
          <LineChart
            label="Weight"
            unit=" kg"
            values={weight}
            startLabel={startLabel}
            endLabel={endLabel}
            fractionDigits={1}
          />
          <LineChart
            label="Sleep score"
            values={sleepScore}
            startLabel={startLabel}
            endLabel={endLabel}
            fractionDigits={0}
          />
          <LineChart
            label="VO₂max"
            values={vo2max}
            startLabel={startLabel}
            endLabel={endLabel}
            fractionDigits={1}
          />
          <LineChart
            label="Sleep hours"
            unit=" h"
            values={sleepHours}
            startLabel={startLabel}
            endLabel={endLabel}
            fractionDigits={1}
          />
        </div>
      </section>
    </>
  );
}

// ─── Goals tab ────────────────────────────────────────────────────

async function GoalsTab({ userId }: { userId: string }) {
  const userGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .limit(1)
    .then((rows) => rows[0]);

  const initial: GoalsInitial = {
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

  return (
    <section className={cardCls}>
      <div className="space-y-1">
        <h2 className={sectionTitle}>Goals</h2>
        <p className="text-xs text-zinc-500">
          Blank fields have no target — progress bars stay quiet.
        </p>
      </div>
      <GoalsForm initial={initial} />
    </section>
  );
}

// ─── Account tab ──────────────────────────────────────────────────

async function AccountTab({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  const connection = await db
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.userId, userId))
    .limit(1)
    .then((rows) => rows[0]);

  return (
    <>
      <section className={cardCls}>
        <h2 className={sectionTitle}>Strava</h2>
        {connection ? (
          <div className="space-y-3">
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
            <div className="flex flex-wrap items-center gap-2">
              <BackfillButton />
              <form action={disconnectStravaAction}>
                <button
                  type="submit"
                  className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  Disconnect
                </button>
              </form>
            </div>
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

      <section className={cardCls}>
        <h2 className={sectionTitle}>Session</h2>
        <p className="text-sm">
          Signed in as <span className="font-medium">{email ?? "—"}</span>
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
