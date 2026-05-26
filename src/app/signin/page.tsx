import { signIn } from "@/auth";
import { Logo } from "@/app/_components/logo";

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo href={null} className="text-2xl" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to continue
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Continue with GitHub
          </button>
        </form>
        <p className="text-center text-xs text-zinc-400">
          Access is restricted to allowlisted accounts.
        </p>
      </div>
    </main>
  );
}
