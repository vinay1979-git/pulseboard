import { Activity } from "lucide-react";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(244,114,182,0.14),transparent_30%),linear-gradient(135deg,#f8fafc,#dbeafe)] px-5 py-5 text-slate-950 dark:bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(244,114,182,0.16),transparent_30%),linear-gradient(135deg,#020617,#111827_52%,#172554)] dark:text-white">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/15 text-cyan-700 dark:text-cyan-200">
            <Activity className="size-5" />
          </span>
          <span className="text-lg font-bold">PulseBoard</span>
        </Link>
        <ThemeToggle />
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-6xl items-center gap-10 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <AuthCard />
        <div className="hidden lg:block">
          <h1 className="max-w-2xl text-5xl font-black leading-tight tracking-normal">
            Sign in to the workspace pulse.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700 dark:text-slate-300">
            Authentication, sessions, route protection, and profile data are all
            handled by Supabase Auth with server-side session refresh.
          </p>
        </div>
      </section>
    </main>
  );
}
