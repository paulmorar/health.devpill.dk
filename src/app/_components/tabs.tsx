import Link from "next/link";

export type TabKey = "day" | "trends" | "goals" | "account";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "day", label: "Day" },
  { key: "trends", label: "Trends" },
  { key: "goals", label: "Goals" },
  { key: "account", label: "Account" },
];

export function Tabs({ active }: { active: TabKey }) {
  return (
    <nav
      role="tablist"
      aria-label="Sections"
      className="flex w-full max-w-md gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/?tab=${t.key}`}
            role="tab"
            aria-selected={isActive}
            className={
              "flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors " +
              (isActive
                ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
