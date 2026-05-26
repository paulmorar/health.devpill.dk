/**
 * Compact "insight chips" row — one-line surfaces of things the user
 * actually wants to know at a glance: streaks, weekly deltas, totals.
 *
 * Server component. Caller supplies an array of `Chip` objects; we just
 * render them in a horizontally-scrolling strip on tiny screens or a wrap
 * grid on wider ones. Chips render quietly when their value is missing
 * (returns null) rather than showing "—".
 */

export type ChipTone = "good" | "warn" | "bad" | "neutral";

export type Chip = {
  /** Single emoji or short SVG-friendly glyph — kept tiny to stay scannable. */
  icon: string;
  /** Headline value (e.g. "3", "−0.6 kg"). */
  value: string;
  /** Smaller label below the value (e.g. "day streak"). */
  label: string;
  tone?: ChipTone;
};

const TONE: Record<ChipTone, { bg: string; text: string; ring: string }> = {
  good: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-200/70 dark:ring-emerald-900",
  },
  warn: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-200/70 dark:ring-amber-900",
  },
  bad: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-200/70 dark:ring-rose-900",
  },
  neutral: {
    bg: "bg-zinc-50 dark:bg-zinc-900",
    text: "text-zinc-700 dark:text-zinc-300",
    ring: "ring-zinc-200 dark:ring-zinc-800",
  },
};

export function InsightChips({ chips }: { chips: Chip[] }) {
  const visible = chips.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {visible.map((c, i) => {
        const t = TONE[c.tone ?? "neutral"];
        return (
          <div
            key={i}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 ring-1 ${t.bg} ${t.ring}`}
          >
            <span aria-hidden className="text-base leading-none">
              {c.icon}
            </span>
            <div className="leading-tight">
              <div className={`text-xs font-bold tabular-nums ${t.text}`}>
                {c.value}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                {c.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
