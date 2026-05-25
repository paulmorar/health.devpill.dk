"use client";

/**
 * Daily wellness form. Upserts a single row for (userId, date). Pre-filled
 * from the existing row for today if any.
 */
import { useActionState, useRef } from "react";
import {
  upsertWellnessLogAction,
  type WellnessActionResult,
} from "@/app/_actions/health";

export type WellnessInitial = {
  date: string; // YYYY-MM-DD
  weightKg: number | null;
  sleepHours: number | null;
  sleepScore: number | null;
  vo2max: number | null;
  mood: number | null;
  energy: number | null;
  notes: string | null;
};

export function WellnessLogForm({ initial }: { initial: WellnessInitial }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState<
    WellnessActionResult | null,
    FormData
  >(upsertWellnessLogAction, null);

  const inputCls =
    "h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950";
  const labelCls = "text-xs font-medium text-zinc-500";

  const def = (v: number | null) => (v == null ? "" : String(v));

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <label htmlFor="w-date" className={labelCls}>
            Date
          </label>
          <input
            id="w-date"
            name="date"
            type="date"
            required
            defaultValue={initial.date}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="w-weight" className={labelCls}>
            Weight (kg)
          </label>
          <input
            id="w-weight"
            name="weightKg"
            type="number"
            step="0.1"
            min="0"
            defaultValue={def(initial.weightKg)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="w-sleep" className={labelCls}>
            Sleep (h)
          </label>
          <input
            id="w-sleep"
            name="sleepHours"
            type="number"
            step="0.1"
            min="0"
            max="24"
            defaultValue={def(initial.sleepHours)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="w-sleep-score" className={labelCls}>
            Sleep score
          </label>
          <input
            id="w-sleep-score"
            name="sleepScore"
            type="number"
            step="1"
            min="0"
            max="100"
            defaultValue={def(initial.sleepScore)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="w-vo2" className={labelCls}>
            VO₂max
          </label>
          <input
            id="w-vo2"
            name="vo2max"
            type="number"
            step="0.1"
            min="0"
            max="100"
            defaultValue={def(initial.vo2max)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="w-mood" className={labelCls}>
            Mood (1–10)
          </label>
          <input
            id="w-mood"
            name="mood"
            type="number"
            step="1"
            min="1"
            max="10"
            defaultValue={def(initial.mood)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="w-energy" className={labelCls}>
            Energy (1–10)
          </label>
          <input
            id="w-energy"
            name="energy"
            type="number"
            step="1"
            min="1"
            max="10"
            defaultValue={def(initial.energy)}
            className={inputCls}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label htmlFor="w-notes" className={labelCls}>
            Notes
          </label>
          <textarea
            id="w-notes"
            name="notes"
            rows={2}
            defaultValue={initial.notes ?? ""}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
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
          {pending ? "Saving…" : "Save wellness"}
        </button>
        <button
          type="button"
          onClick={() => {
            const form = formRef.current;
            if (!form) return;
            // Empty every numeric/text field but keep the date pinned to
            // today (clearing makes no sense for the row identifier).
            const clear = (name: string) => {
              const el = form.elements.namedItem(name) as
                | HTMLInputElement
                | HTMLTextAreaElement
                | null;
              if (el) el.value = "";
            };
            clear("weightKg");
            clear("sleepHours");
            clear("sleepScore");
            clear("vo2max");
            clear("mood");
            clear("energy");
            clear("notes");
          }}
          className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
