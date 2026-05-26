/**
 * Small inline SVG icon + accent color keyed off Strava `sportType`.
 *
 * Kept as pure SVG (no icon lib) so we ship zero extra JS. Colors match
 * the dark-mode emerald/blue/amber palette but stay legible on light
 * backgrounds thanks to a soft tinted bubble background.
 */

export type SportTone = {
  /** Tailwind color used for the icon bubble background + ring border. */
  bubble: string;
  /** Tailwind color used for the icon stroke. */
  stroke: string;
  /** Short human label, also doubles as the left-accent color hue. */
  label: string;
};

const TONES: Record<string, SportTone> = {
  run: {
    bubble:
      "bg-rose-500/10 ring-rose-500/30 dark:bg-rose-400/10 dark:ring-rose-400/30",
    stroke: "text-rose-600 dark:text-rose-400",
    label: "Run",
  },
  ride: {
    bubble:
      "bg-emerald-500/10 ring-emerald-500/30 dark:bg-emerald-400/10 dark:ring-emerald-400/30",
    stroke: "text-emerald-600 dark:text-emerald-400",
    label: "Ride",
  },
  swim: {
    bubble:
      "bg-cyan-500/10 ring-cyan-500/30 dark:bg-cyan-400/10 dark:ring-cyan-400/30",
    stroke: "text-cyan-600 dark:text-cyan-400",
    label: "Swim",
  },
  walk: {
    bubble:
      "bg-violet-500/10 ring-violet-500/30 dark:bg-violet-400/10 dark:ring-violet-400/30",
    stroke: "text-violet-600 dark:text-violet-400",
    label: "Walk",
  },
  hike: {
    bubble:
      "bg-lime-500/10 ring-lime-500/30 dark:bg-lime-400/10 dark:ring-lime-400/30",
    stroke: "text-lime-600 dark:text-lime-400",
    label: "Hike",
  },
  strength: {
    bubble:
      "bg-indigo-500/10 ring-indigo-500/30 dark:bg-indigo-400/10 dark:ring-indigo-400/30",
    stroke: "text-indigo-600 dark:text-indigo-400",
    label: "Strength",
  },
  football: {
    bubble:
      "bg-sky-500/10 ring-sky-500/30 dark:bg-sky-400/10 dark:ring-sky-400/30",
    stroke: "text-sky-600 dark:text-sky-400",
    label: "Football",
  },
  default: {
    bubble:
      "bg-zinc-500/10 ring-zinc-500/30 dark:bg-zinc-400/10 dark:ring-zinc-400/30",
    stroke: "text-zinc-600 dark:text-zinc-400",
    label: "Activity",
  },
};

/** Map Strava `sport_type` strings to our tone bucket. */
export function sportTone(sportType: string | null | undefined): SportTone {
  if (!sportType) return TONES.default;
  const k = sportType.toLowerCase();
  if (k.includes("run")) return TONES.run;
  if (k.includes("ride") || k.includes("cycl") || k.includes("bike"))
    return TONES.ride;
  if (k.includes("swim")) return TONES.swim;
  if (k.includes("walk")) return TONES.walk;
  if (k.includes("hike")) return TONES.hike;
  if (
    k.includes("weight") ||
    k.includes("strength") ||
    k.includes("workout") ||
    k.includes("crossfit")
  )
    return TONES.strength;
  if (k.includes("soccer") || k.includes("football") || k.includes("futsal"))
    return TONES.football;
  return TONES.default;
}

export function SportIcon({
  sportType,
  size = 36,
}: {
  sportType: string | null | undefined;
  size?: number;
}) {
  const tone = sportTone(sportType);
  const path = iconPath(sportType);
  const inner = Math.round(size * 0.55);
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-full ring-1 ${tone.bubble}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={inner}
        height={inner}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={tone.stroke}
      >
        {path}
      </svg>
    </div>
  );
}

/** Tiny line-icon set, one path per sport bucket. */
function iconPath(sportType: string | null | undefined) {
  const k = (sportType ?? "").toLowerCase();
  if (k.includes("run")) {
    return (
      <>
        <circle cx="13" cy="4.5" r="1.5" />
        <path d="M5 19l3.5-4 1.5-3-2-1.5-2 2.5" />
        <path d="M9 9.5l3-2 2.5 1.5 1.5 3 3-1" />
        <path d="M11.5 13l2 3 4-1" />
      </>
    );
  }
  if (k.includes("ride") || k.includes("cycl") || k.includes("bike")) {
    return (
      <>
        <circle cx="5" cy="17" r="3.5" />
        <circle cx="19" cy="17" r="3.5" />
        <path d="M5 17l4-7h6l4 7M9 10l1.5-3h3" />
      </>
    );
  }
  if (k.includes("swim")) {
    return (
      <>
        <path d="M3 12c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
        <path d="M3 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
        <circle cx="9" cy="7" r="1.5" />
        <path d="M10 8l4 2 3-1" />
      </>
    );
  }
  if (k.includes("walk") || k.includes("hike")) {
    return (
      <>
        <circle cx="13" cy="4.5" r="1.5" />
        <path d="M9 21l2-5 2-3-2-2-2 3" />
        <path d="M11 11l3-1 2 3 2 1" />
      </>
    );
  }
  if (
    k.includes("weight") ||
    k.includes("strength") ||
    k.includes("workout") ||
    k.includes("crossfit")
  ) {
    return (
      <>
        <path d="M3 9v6M21 9v6M6 7v10M18 7v10M6 12h12" />
      </>
    );
  }
  if (k.includes("soccer") || k.includes("football") || k.includes("futsal")) {
    return (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 5l5 3.5-2 6h-6l-2-6L12 5zM12 14v5M5 9l3 1M19 9l-3 1M9 15l-2 4M15 15l2 4" />
      </>
    );
  }
  // generic spark/dot
  return (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  );
}
