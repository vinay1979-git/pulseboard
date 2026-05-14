import Link from "next/link";
import { Activity, ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_75%_15%,rgba(244,114,182,0.13),transparent_28%),linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_75%_15%,rgba(244,114,182,0.15),transparent_28%),linear-gradient(135deg,#020617,#111827_48%,#172554)] dark:text-white">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/15 text-cyan-700 dark:text-cyan-200">
            <Activity className="size-5" />
          </span>
          <span className="text-lg font-bold">PulseBoard</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="secondary">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-92px)] w-full max-w-6xl items-center gap-10 px-5 pb-10 pt-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-white/65 px-3 py-2 text-sm font-medium text-cyan-800 backdrop-blur dark:bg-white/9 dark:text-cyan-100">
            <Sparkles className="size-4" />
            Secure team signals, one board
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-normal text-slate-950 dark:text-white sm:text-6xl">
            PulseBoard
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700 dark:text-slate-300">
            A modern, authenticated command center for teams that need crisp
            visibility, secure profiles, and fast access across every device.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/login">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">
                Open dashboard
                <LockKeyhole className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-white/18 bg-white/70 p-4 shadow-2xl shadow-slate-950/10 backdrop-blur-xl dark:bg-white/9 dark:shadow-cyan-950/30">
          <div className="grid gap-3">
            {[
              ["Auth health", "Protected", "bg-cyan-300"],
              ["Workspace pulse", "Live", "bg-emerald-300"],
              ["Profile sync", "Ready", "bg-fuchsia-300"],
            ].map(([label, value, color]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-md border border-slate-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-950/40"
              >
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                    {value}
                  </p>
                </div>
                <span className={`h-3 w-3 rounded-full ${color}`} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
