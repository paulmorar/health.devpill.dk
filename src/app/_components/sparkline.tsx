/**
 * Inline-SVG sparkline. Handles `null` gaps by breaking the path into
 * multiple <path>s so missing days don't draw a fake straight line.
 *
 * Width is fluid (100%) via preserveAspectRatio="none"; height is fixed in
 * the viewBox so the curve scales nicely inside narrow cards.
 */
export function Sparkline({
  values,
  label,
  unit = "",
  fractionDigits = 1,
  width = 240,
  height = 48,
}: {
  values: Array<number | null>;
  label: string;
  unit?: string;
  fractionDigits?: number;
  width?: number;
  height?: number;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-zinc-500">{label}</span>
          <span className="text-zinc-400">no data</span>
        </div>
        <div className="h-12 w-full rounded-md bg-zinc-50 dark:bg-zinc-900" />
      </div>
    );
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const last = [...nums].at(-1)!;
  const first = nums[0];
  const delta = last - first;

  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const pad = 4;
  const yOf = (v: number) =>
    height - pad - ((v - min) / range) * (height - 2 * pad);

  // Build path segments, breaking on nulls.
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
      ? ` L${x.toFixed(2)} ${y.toFixed(2)}`
      : `M${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  if (cur) segments.push(cur);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

  const deltaSign = delta > 0 ? "+" : "";
  const deltaCls =
    delta === 0
      ? "text-zinc-400"
      : delta > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";

  // Last-point dot
  const lastIdx =
    values.length - 1 - [...values].reverse().findIndex((v) => v != null);
  const lastX = lastIdx * stepX;
  const lastY = yOf(last);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-zinc-500">{label}</span>
        <span className="tabular-nums">
          <span className="text-zinc-900 dark:text-zinc-100">
            {fmt(last)}
            {unit}
          </span>
          <span className={"ml-2 " + deltaCls}>
            {deltaSign}
            {fmt(delta)}
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-12 w-full text-zinc-900 dark:text-zinc-100"
      >
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle cx={lastX} cy={lastY} r={2.5} fill="currentColor" />
      </svg>
    </div>
  );
}
