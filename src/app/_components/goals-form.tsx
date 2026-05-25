"use client";

/**
 * Per-user goals form (Phase 3). Singleton upsert keyed by userId. All
 * fields optional — blank means "no goal", which the UI uses to hide
 * progress bars rather than showing 0%.
 */
import { useActionState, useRef } from "react";
import {
  upsertGoalsAction,
  type GoalsActionResult,
} from "@/app/_actions/health";

export type GoalsInitial = {
  dailyKcal: number | null;
  dailyProteinG: number | null;
  dailyCarbsG: number | null;
  dailyFatG: number | null;
  weeklyActiveKm: number | null;
  weeklyActiveMinutes: number | null;
  weeklyActivitiesCount: number | null;
  targetWeightKg: number | null;
  dailySleepHours: number | null;
};

export function GoalsForm({ initial }: { initial: GoalsInitial }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState<
    GoalsActionResult | null,
    FormData
  >(upsertGoalsAction, null);

  const inputCls =
    "h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950";
  const labelCls = "text-xs font-medium text-zinc-500";
  const def = (v: number | null) => (v == null ? "" : String(v));

  const fields: Array<{
    name: keyof GoalsInitial;
    label: string;
    step: string;
    min?: string;
    max?: string;
  }> = [
    { name: "dailyKcal", label: "Daily kcal", step: "10", min: "0" },
    { name: "dailyProteinG", label: "Daily protein (g)", step: "1", min: "0" },
    { name: "dailyCarbsG", label: "Daily carbs (g)", step: "1", min: "0" },
    { name: "dailyFatG", label: "Daily fat (g)", step: "1", min: "0" },
    {
      name: "dailySleepHours",
      label: "Daily sleep (h)",
      step: "0.1",
      min: "0",
      max: "24",
    },
    { name: "weeklyActiveKm", label: "Weekly km", step: "0.1", min: "0" },
    {
      name: "weeklyActiveMinutes",
      label: "Weekly minutes",
      step: "1",
      min: "0",
    },
    {
      name: "weeklyActivitiesCount",
      label: "Weekly activities",
      step: "1",
      min: "0",
    },
    {
      name: "targetWeightKg",
      label: "Target weight (kg)",
      step: "0.1",
      min: "0",
    },
  ];

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1">
            <label htmlFor={`g-${f.name}`} className={labelCls}>
              {f.label}
            </label>
            <input
              id={`g-${f.name}`}
              name={f.name}
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              defaultValue={def(initial[f.name])}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {state && !state.ok && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved.</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save goals"}
        </button>
        <button
          type="button"
          onClick={() => {
            const form = formRef.current;
            if (!form) return;
            for (const f of fields) {
              const el = form.elements.namedItem(
                f.name,
              ) as HTMLInputElement | null;
              if (el) el.value = "";
            }
          }}
          className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
