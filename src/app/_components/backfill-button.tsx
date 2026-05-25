"use client";

/**
 * Client wrapper around `backfillStravaAction` that:
 * - shows a pending state while the action runs (useTransition)
 * - displays the imported count / error returned by the action
 *
 * The action itself calls `revalidatePath("/")` so the activity list
 * below it refreshes automatically once it resolves.
 */
import { useState, useTransition } from "react";
import { backfillStravaAction } from "@/app/_actions/strava";

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Please sign in again.",
  no_strava_connection: "Connect Strava first.",
  fetch_failed: "Could not reach Strava. Try again in a minute.",
};

export function BackfillButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok"; text: string } | { kind: "err"; text: string } | null
  >(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await backfillStravaAction();
            if (result.ok) {
              setMessage({
                kind: "ok",
                text:
                  result.imported === 0
                    ? "No new activities in the last 30 days."
                    : `Imported ${result.imported} ${
                        result.imported === 1 ? "activity" : "activities"
                      }.`,
              });
            } else {
              setMessage({
                kind: "err",
                text: ERROR_MESSAGES[result.error] ?? result.error,
              });
            }
          });
        }}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        {pending ? "Importing…" : "Backfill last 30 days"}
      </button>
      {message && (
        <p
          className={
            message.kind === "ok"
              ? "text-xs text-emerald-600 dark:text-emerald-400"
              : "text-xs text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
