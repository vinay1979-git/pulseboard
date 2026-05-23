import { Activity } from "lucide-react";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(6,182,212,0.15),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(139,92,246,0.12),transparent_30%),linear-gradient(135deg,#070a13,#0f172a)] px-6 py-6 text-slate-100 flex flex-col justify-between">
      {/* Top Navbar */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 group-hover:scale-105 transition-transform">
            <Activity className="size-5" />
          </span>
          <span className="text-lg font-black bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
            PulseBoard
          </span>
        </Link>
        <ThemeToggle />
      </nav>

      {/* Main Auth Section */}
      <section className="mx-auto grid min-h-[calc(100vh-120px)] w-full max-w-6xl items-center gap-12 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <AuthCard />
        <div className="hidden lg:block text-left">
          <h1 className="max-w-2xl text-5xl font-black leading-tight tracking-tight text-white">
            Access the <br />
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Workspace Pulse.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Authentication, session handling, database sync, and route protection are fully operational on your Supabase client with safe local mock fallbacks.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 py-3">
        PulseBoard Anonymous Signal System &copy; {new Date().getFullYear()}
      </footer>
    </main>
  );
}
