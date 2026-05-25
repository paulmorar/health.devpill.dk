"use client";

/**
 * Tiny show/hide wrapper used for "+ Add" / "Edit" affordances on forms.
 * Keeps the form mounted only while open so server-action state resets on
 * each open — sensible for log-style forms that are written once per click.
 */
import { useState, type ReactNode } from "react";

export function Collapsible({
  addLabel,
  cancelLabel = "Cancel",
  defaultOpen = false,
  variant = "primary",
  children,
}: {
  addLabel: string;
  cancelLabel?: string;
  defaultOpen?: boolean;
  variant?: "primary" | "ghost";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const openCls =
    variant === "primary"
      ? "h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      : "h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          open
            ? "h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            : openCls
        }
      >
        {open ? cancelLabel : addLabel}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
