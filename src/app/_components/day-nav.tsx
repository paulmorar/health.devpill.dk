"use client";

/**
 * Prev / date-picker / next navigator for the Day tab. Uses URL state via
 * router.push so the server component can re-read `?d=YYYY-MM-DD`.
 */
import { useRouter } from "next/navigation";

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DayNav({ date }: { date: string }) {
  const router = useRouter();
  const today = todayIso();
  const isToday = date === today;
  const isFuture = date > today;

  const go = (d: string) => router.push(`/?tab=day&d=${d}`);

  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const btn =
    "h-9 w-9 rounded-md border border-zinc-200 text-sm font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(shiftIso(date, -1))}
        className={btn}
        aria-label="Previous day"
      >
        ←
      </button>
      <div className="flex flex-1 flex-col items-center">
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => go(e.target.value)}
          className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-center text-sm font-medium dark:border-zinc-800 dark:bg-zinc-950"
          aria-label="Pick date"
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          {label}
          {isToday && <span className="ml-1 text-emerald-600">· today</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={() => go(shiftIso(date, 1))}
        className={btn}
        disabled={isToday || isFuture}
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}
