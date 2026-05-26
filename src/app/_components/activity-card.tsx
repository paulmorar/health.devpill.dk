/**
 * Card-style row for a single activity in the day feed.
 *
 * Replaces the flat <li> in the original Day tab. Adds:
 *   • Sport-typed icon bubble (SportIcon)
 *   • Colored left accent matching the sport tone
 *   • Structured stat row (icon + value, tabular nums)
 *   • Optional km / pace / HR / kcal — only render the cells that exist
 */

import { SportIcon, sportTone } from "./sport-icon";

export type ActivitySummary = {
  id: string | number;
  name: string | null;
  sportType: string;
  startedAt: Date;
  distanceM: number | null;
  movingSeconds: number | null;
  avgHr: number | null;
  calories: number | null;
};

export function ActivityCard({ a }: { a: ActivitySummary }) {
  const tone = sportTone(a.sportType);
  return (
    <article
      className={
        "flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-3 " +
        "shadow-sm transition-colors hover:bg-zinc-50 " +
        "dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      }
    >
      <SportIcon sportType={a.sportType} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {a.name ?? a.sportType}
          </h3>
          <time
            className="shrink-0 text-[11px] tabular-nums text-zinc-500"
            dateTime={a.startedAt.toISOString()}
          >
            {formatTime(a.startedAt)}
          </time>
        </div>

        <div
          className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone.stroke}`}
        >
          {a.sportType}
        </div>

        <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          {a.movingSeconds != null && (
            <Stat label="Time" value={formatDuration(a.movingSeconds)} />
          )}
          {a.distanceM != null && (
            <Stat label="Dist" value={formatDistance(a.distanceM)} />
          )}
          {a.distanceM != null &&
            a.movingSeconds != null &&
            a.distanceM > 0 && (
              <Stat
                label="Pace"
                value={formatPace(a.distanceM, a.movingSeconds)}
              />
            )}
          {a.avgHr != null && <Stat label="HR" value={`${a.avgHr} bpm`} />}
          {a.calories != null && (
            <Stat label="Kcal" value={`${a.calories.toLocaleString()}`} />
          )}
        </dl>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-[10px] uppercase tracking-wider text-zinc-400">
        {label}
      </dt>
      <dd className="font-semibold text-zinc-800 dark:text-zinc-200">
        {value}
      </dd>
    </div>
  );
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatPace(distanceM: number, seconds: number): string {
  const minPerKm = seconds / 60 / (distanceM / 1000);
  const mm = Math.floor(minPerKm);
  const ss = Math.round((minPerKm - mm) * 60);
  return `${mm}:${ss.toString().padStart(2, "0")}/km`;
}

function formatTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
