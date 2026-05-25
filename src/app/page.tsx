import { auth, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Logged in as <span className="font-medium">{session?.user?.email}</span>
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Phase 0 complete — auth + database wired. Strava connect, wellness
          entries, food logging, and goals land in later phases.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            className="h-10 rounded-lg border border-zinc-200 px-4 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
