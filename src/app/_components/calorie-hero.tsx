/**
 * Day-tab hero: big calorie ring with the day's key numbers around it.
 *
 * Inputs:
 *   consumed — kcal from food logs (sum)
 *   burned   — kcal from logged activities (sum) — may be 0
 *   goal     — daily kcal target from goals; may be null
 *
 * Surfaces three numbers the prototype hid in stacked progress bars:
 *   • Remaining (or Over by) — primary action signal
 *   • Burned                 — credit from activity
 *   • Net                    — consumed − burned, the metric that
 *                              actually drives weight outcomes
 */

export function CalorieHero({
  consumed,
  burned,
  goal,
}: {
  consumed: number;
  burned: number;
  goal: number | null;
}) {
  const size = 168;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const hasGoal = goal != null && goal > 0;
  const ratio = hasGoal ? Math.min(consumed / (goal as number), 1) : 0;
  const offset = circ * (1 - ratio);
  const over = hasGoal && consumed > (goal as number);
  const remaining = hasGoal ? (goal as number) - consumed : 0;
  const net = consumed - burned;

  const ringClass = over
    ? "stroke-rose-500 dark:stroke-rose-400"
    : "stroke-emerald-500 dark:stroke-emerald-400";

  const remainingLabel = !hasGoal
    ? "set a kcal goal"
    : remaining > 0
      ? `${Math.round(remaining).toLocaleString()} left`
      : `${Math.round(-remaining).toLocaleString()} over`;
  const remainingClass = !hasGoal
    ? "text-zinc-500"
    : remaining > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-rose-700 dark:text-rose-400";

  const aria = hasGoal
    ? `Calories consumed ${Math.round(consumed)} of ${goal}; ${remainingLabel}`
    : `Calories consumed ${Math.round(consumed)}; no goal set`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={aria}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-zinc-200 dark:stroke-zinc-800"
          />
          {hasGoal && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              className={ringClass}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Calories
          </div>
          <div className="mt-0.5 text-4xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-50">
            {Math.round(consumed).toLocaleString()}
          </div>
          {hasGoal ? (
            <div className="mt-1 text-[11px] text-zinc-500">
              of {(goal as number).toLocaleString()} kcal
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-zinc-500">kcal in</div>
          )}
          <div
            className={`mt-1.5 text-xs font-semibold tabular-nums ${remainingClass}`}
          >
            {remainingLabel}
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-3 gap-2 text-center">
        <HeroStat
          label="In"
          value={Math.round(consumed).toLocaleString()}
          unit="kcal"
          tone="neutral"
        />
        <HeroStat
          label="Burned"
          value={burned > 0 ? Math.round(burned).toLocaleString() : "—"}
          unit={burned > 0 ? "kcal" : ""}
          tone={burned > 0 ? "good" : "muted"}
        />
        <HeroStat
          label="Net"
          value={Math.round(net).toLocaleString()}
          unit="kcal"
          tone={hasGoal && net > (goal as number) ? "warn" : "neutral"}
        />
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: "neutral" | "good" | "warn" | "muted";
}) {
  const valueCls = {
    neutral: "text-zinc-900 dark:text-zinc-100",
    good: "text-emerald-700 dark:text-emerald-400",
    warn: "text-amber-700 dark:text-amber-400",
    muted: "text-zinc-400 dark:text-zinc-600",
  }[tone];
  return (
    <div className="rounded-lg border border-zinc-100 px-2 py-2 dark:border-zinc-900">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${valueCls}`}>
        {value}
        {unit && (
          <span className="ml-0.5 text-[10px] font-normal text-zinc-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
