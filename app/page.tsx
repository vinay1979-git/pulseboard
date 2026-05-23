import Link from "next/link";
import { Activity, ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.15),transparent_40%),radial-gradient(circle_at_75%_15%,rgba(139,92,246,0.12),transparent_35%),linear-gradient(185deg,#070a13,#0f172a)] text-slate-100 flex flex-col justify-between">
      {/* Navbar */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 border-b border-white/5 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 group-hover:scale-105 transition-transform">
            <Activity className="size-5" />
          </span>
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
            PulseBoard
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="secondary" className="h-11 px-5 border border-white/10 bg-slate-900/60 hover:bg-slate-900 text-white font-semibold">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto grid min-h-[calc(100vh-180px)] w-full max-w-6xl items-center gap-12 px-6 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center text-left">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-cyan-400 backdrop-blur">
            <Sparkles className="size-3.5" />
            Secure team signals &middot; real-time
          </div>
          
          <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6.5xl">
            Sleek Live Polling <br />
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              In A Single Pulse.
            </span>
          </h1>
          
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            A modern, authenticated command center for teams that need crisp visibility, secure profiles, and highly interactive live polls with beautiful word clouds.
          </p>
          
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 px-6 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 group">
              <Link href="/login">
                Get started
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-12 px-6 border border-white/10 bg-slate-900/60 hover:bg-slate-900 text-white font-semibold flex items-center justify-center gap-2">
              <Link href="/dashboard">
                Open dashboard
                <LockKeyhole className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-12 px-6 border border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/10 text-cyan-400 font-extrabold flex items-center justify-center gap-2">
              <Link href="/join">
                Join a session
                <Activity className="size-4 animate-pulse" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Visual Showcase Card */}
        <div className="rounded-2xl border border-white/8 bg-slate-900/40 p-6 shadow-3xl shadow-slate-950/50 backdrop-blur-xl relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/10 to-violet-500/10 opacity-30 pointer-events-none" />
          
          <div className="grid gap-4">
            {[
              ["Signal room status", "Live Syncing", "bg-cyan-400", "shadow-cyan-400/30"],
              ["Workspace pulse", "Premium Dark Mode", "bg-emerald-400", "shadow-emerald-400/30"],
              ["Anonymous feedback", "Protected", "bg-fuchsia-400", "shadow-fuchsia-400/30"],
            ].map(([label, value, color, glow]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 p-5 backdrop-blur-md"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1.5 text-lg font-black text-slate-100">
                    {value}
                  </p>
                </div>
                <span className={`h-3 w-3 rounded-full ${color} shadow-lg ${glow} animate-pulse`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 py-6 border-t border-white/5">
        PulseBoard &copy; {new Date().getFullYear()} &middot; Built for Premium Real-Time Operations.
      </footer>
    </main>
  );
}
