import Link from "next/link";

export type RangeDays = 14 | 30 | 90;

const OPTIONS: RangeDays[] = [14, 30, 90];

export function RangeSelector({ active }: { active: RangeDays }) {
  return (
    <div className="flex gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      {OPTIONS.map((n) => {
        const isActive = n === active;
        return (
          <Link
            key={n}
            href={`/?tab=trends&range=${n}`}
            className={
              "flex-1 rounded px-2 py-1 text-center text-xs font-medium " +
              (isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900")
            }
          >
            {n}d
          </Link>
        );
      })}
    </div>
  );
}
