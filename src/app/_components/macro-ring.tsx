/**
 * Macro progress ring. Pure SVG, server-renderable.
 *
 * Color semantics — fixing the prototype's bug where every "over goal"
 * was rendered red:
 *   - `overIsGood: true`  → exceeding goal stays in the macro's own color
 *                            (good thing: e.g. protein, active minutes).
 *   - `overIsGood: false` → exceeding goal switches to amber as a soft
 *                            warning (e.g. fat, carbs).
 *
 * With no goal we render a quiet, unfilled ring so the slot keeps its
 * place in the layout but reads as "no target set".
 */

type Tone = "protein" | "carbs" | "fat" | "kcal" | "neutral";

const TONE: Record<Tone, { stroke: string; text: string; track: string }> = {
  protein: {
    stroke: "stroke-sky-500 dark:stroke-sky-400",
    text: "text-sky-700 dark:text-sky-300",
    track: "stroke-zinc-200 dark:stroke-zinc-800",
  },
  carbs: {
    stroke: "stroke-amber-500 dark:stroke-amber-400",
    text: "text-amber-700 dark:text-amber-300",
    track: "stroke-zinc-200 dark:stroke-zinc-800",
  },
  fat: {
    stroke: "stroke-pink-500 dark:stroke-pink-400",
    text: "text-pink-700 dark:text-pink-300",
    track: "stroke-zinc-200 dark:stroke-zinc-800",
  },
  kcal: {
    stroke: "stroke-emerald-500 dark:stroke-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    track: "stroke-zinc-200 dark:stroke-zinc-800",
  },
  neutral: {
    stroke: "stroke-zinc-400 dark:stroke-zinc-500",
    text: "text-zinc-700 dark:text-zinc-300",
    track: "stroke-zinc-200 dark:stroke-zinc-800",
  },
};

export function MacroRing({
  label,
  current,
  goal,
  tone,
  overIsGood = false,
  unit = "g",
  size = 72,
}: {
  label: string;
  current: number;
  goal: number | null;
  tone: Tone;
  overIsGood?: boolean;
  unit?: string;
  size?: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const hasGoal = goal != null && goal > 0;
  const ratio = hasGoal ? Math.min(current / (goal as number), 1) : 0;
  const offset = circ * (1 - ratio);
  const over = hasGoal && current > (goal as number);

  // Active stroke: warning amber if over and over is bad; otherwise tone color.
  const activeStrokeClass =
    over && !overIsGood
      ? "stroke-amber-500 dark:stroke-amber-400"
      : TONE[tone].stroke;
  const valueColorClass =
    over && !overIsGood
      ? "text-amber-700 dark:text-amber-300"
      : TONE[tone].text;

  const aria = hasGoal
    ? `${label}: ${Math.round(current)} of ${goal}${unit}` +
      (over
        ? ` — over goal by ${Math.round(current - (goal as number))}${unit}`
        : "")
    : `${label}: ${Math.round(current)}${unit} (no goal set)`;

  return (
    <div className="flex flex-col items-center" role="img" aria-label={aria}>
      <div className="relative" style={{ width: size, height: size }}>
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
            className={TONE[tone].track}
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
              className={activeStrokeClass}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={`text-base font-bold tabular-nums leading-none ${valueColorClass}`}
          >
            {Math.round(current)}
          </div>
          {hasGoal ? (
            <div className="mt-0.5 text-[10px] tabular-nums text-zinc-500">
              /{goal}
              {unit}
            </div>
          ) : (
            <div className="mt-0.5 text-[10px] text-zinc-400">{unit}</div>
          )}
        </div>
      </div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  );
}
