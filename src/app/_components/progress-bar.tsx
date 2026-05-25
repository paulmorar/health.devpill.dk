/**
 * Tiny presentational progress bar. If `goal` is null, renders just the
 * current value (no bar) — keeps the UI honest about "no target set".
 */
export function ProgressBar({
  label,
  current,
  goal,
  unit = "",
  fractionDigits = 0,
}: {
  label: string;
  current: number;
  goal: number | null;
  unit?: string;
  fractionDigits?: number;
}) {
  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    });

  if (goal == null || goal <= 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-zinc-500">{label}</span>
          <span className="text-zinc-900 dark:text-zinc-100">
            {fmt(current)}
            {unit}
          </span>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, (current / goal) * 100));
  const over = current > goal;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-zinc-500">{label}</span>
        <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
          {fmt(current)}
          <span className="text-zinc-400">
            {" "}
            / {fmt(goal)}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={
            (over
              ? "bg-amber-500 dark:bg-amber-400"
              : "bg-emerald-500 dark:bg-emerald-400") +
            " h-full rounded-full transition-[width]"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
