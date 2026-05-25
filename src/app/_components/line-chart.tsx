/**
 * Bigger sibling of <Sparkline> used on the Trends tab. Adds min/max
 * y-axis hints, per-point dots, and a date-range footer. Still SVG-only
 * to keep bundle small.
 */
export function LineChart({
  label,
  unit = "",
  values,
  startLabel,
  endLabel,
  fractionDigits = 1,
}: {
  label: string;
  unit?: string;
  values: Array<number | null>;
  startLabel: string;
  endLabel: string;
  fractionDigits?: number;
}) {
  const nums = values.filter((v): v is number => v != null);
  const hasData = nums.length > 0;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      maximumFractionDigits: fractionDigits,
    });

  if (!hasData) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <div className="flex h-28 items-center justify-center rounded-md bg-zinc-50 text-xs text-zinc-400 dark:bg-zinc-900">
          No data in this range.
        </div>
      </div>
    );
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const first = nums[0];
  const last = [...nums].at(-1)!;
  const delta = last - first;

  const width = 600;
  const height = 120;
  const pad = 10;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const yOf = (v: number) =>
    height - pad - ((v - min) / range) * (height - 2 * pad);

  // Build path segments, breaking on nulls so missing days don't get a
  // fake straight bridge.
  const segments: string[] = [];
  let cur = "";
  values.forEach((v, i) => {
    if (v == null) {
      if (cur) {
        segments.push(cur);
        cur = "";
      }
      return;
    }
    const x = i * stepX;
    const y = yOf(v);
    cur += cur
      ? ` L${x.toFixed(1)} ${y.toFixed(1)}`
      : `M${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  const deltaSign = delta > 0 ? "+" : "";
  const deltaCls =
    delta === 0
      ? "text-zinc-400"
      : delta > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <div className="text-xs tabular-nums">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {fmt(last)}
            {unit}
          </span>
          <span className={"ml-2 " + deltaCls}>
            {deltaSign}
            {fmt(delta)}
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-28 w-full text-emerald-500 dark:text-emerald-400"
      >
        {/* baseline hints */}
        <line
          x1="0"
          x2={width}
          y1={pad}
          y2={pad}
          stroke="currentColor"
          strokeOpacity="0.1"
        />
        <line
          x1="0"
          x2={width}
          y1={height - pad}
          y2={height - pad}
          stroke="currentColor"
          strokeOpacity="0.1"
        />
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {values.map((v, i) =>
          v == null ? null : (
            <circle
              key={i}
              cx={i * stepX}
              cy={yOf(v)}
              r={2}
              fill="currentColor"
            />
          ),
        )}
      </svg>
      <div className="flex justify-between text-[10px] tabular-nums text-zinc-400">
        <span>
          {fmt(min)}
          {unit} – {fmt(max)}
          {unit}
        </span>
        <span>
          {startLabel} → {endLabel}
        </span>
      </div>
    </div>
  );
}
