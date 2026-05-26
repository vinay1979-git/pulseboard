"use client";

import {
  Activity,
  Home,
  LogOut,
  UserRound,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Join PulseRoom", href: "/join", icon: Activity },
  { label: "Profile", href: "/profile", icon: UserRound },
];

export function AppShell({
  children,
  email,
  identityLabel,
  role,
}: {
  children: React.ReactNode;
  email: string;
  identityLabel?: string;
  role?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = [
    ...navItems,
    ...(role === "super-admin"
      ? [{ label: "User Admin", href: "/admin/users", icon: UserCog }]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_5%,rgba(6,182,212,0.12),transparent_28%),linear-gradient(135deg,#070a13,#0f172a)] text-slate-100">
      {/* Sidebar - Sleek carbon glass */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/5 bg-slate-950/80 px-4 py-6 backdrop-blur-2xl lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2 group">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 group-hover:scale-105 transition-transform">
            <Activity className="size-5" />
          </span>
          <span className="text-xl font-black bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
            PulseBoard
          </span>
        </Link>

        <nav className="mt-10 grid gap-1.5">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-400 transition-all hover:bg-white/5 hover:text-white cursor-pointer",
                  active &&
                    "bg-cyan-400/10 text-cyan-400 shadow-md border border-cyan-400/10",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Pro Badge */}
        <div className="absolute bottom-6 left-4 right-4 rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-4 backdrop-blur">
          <p className="text-sm font-black text-cyan-400">PulseRoom Pro</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            Create, manage, and present live word clouds and polls securely.
          </p>
        </div>
      </aside>

      {/* Main Body Wrap */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <nav className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/60 backdrop-blur-md">
          <div className="flex h-16 w-full items-center justify-between px-6">
            <Link href="/dashboard" className="flex items-center gap-3 lg:hidden group">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
                <Activity className="size-4.5" />
              </span>
              <span className="font-black text-white text-base">PulseBoard</span>
            </Link>

            <div className="hidden lg:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Active PulseRoom Account
              </p>
              <p className="text-sm font-extrabold text-slate-200 mt-0.5">
                {identityLabel ?? email}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button type="button" variant="danger" className="h-10 px-4 font-bold border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white cursor-pointer" onClick={signOut}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </nav>

        {/* Mobile Horizontal Menu */}
        <nav className="border-b border-white/5 bg-slate-950/30 px-3 py-2.5 backdrop-blur-md lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black uppercase tracking-wider text-slate-400 border border-transparent cursor-pointer",
                  pathname === item.href &&
                    "bg-cyan-400/10 text-cyan-400 border-cyan-400/10 shadow-sm",
                )}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Main Content Workspace */}
        <div className="w-full px-6 py-8 flex-1">{children}</div>
      </div>
    </main>
  );
}
