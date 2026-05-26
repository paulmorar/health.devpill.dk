import Link from "next/link";

/**
 * Brand mark for health.devpill.dk.
 *
 * Mirrors the devpill.dk visual language: lowercase wordmark in a
 * geometric sans, paired with a small accent dot. devpill uses cyan;
 * the health surface uses emerald to tie into the rest of the UI.
 */
export function Logo({
  href = "/",
  className = "",
}: {
  href?: string | null;
  className?: string;
}) {
  const content = (
    <span
      className={
        "inline-flex items-baseline gap-1 font-semibold tracking-tight " +
        className
      }
    >
      <span className="text-zinc-900 dark:text-zinc-100">health</span>
      <span
        aria-hidden
        className="inline-block size-1.5 translate-y-[-0.15em] rounded-full bg-emerald-500"
      />
      <span className="text-zinc-500 dark:text-zinc-400">devpill</span>
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      aria-label="health.devpill.dk — home"
    >
      {content}
    </Link>
  );
}
