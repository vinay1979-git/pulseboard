"use client";

import {
  Activity,
  BarChart3,
  Blocks,
  FolderKanban,
  Home,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Builder", href: "/builder", icon: Blocks },
  { label: "Polls", href: "/polls", icon: BarChart3 },
  { label: "Presentations", href: "/dashboard", icon: FolderKanban },
  { label: "Analytics", href: "/dashboard", icon: BarChart3 },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Settings", href: "/profile", icon: Settings },
];

export function AppShell({
  children,
  email,
  identityLabel,
}: {
  children: React.ReactNode;
  email: string;
  identityLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_5%,rgba(34,211,238,0.14),transparent_28%),linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-950 dark:bg-[radial-gradient(circle_at_12%_5%,rgba(34,211,238,0.15),transparent_28%),linear-gradient(135deg,#020617,#111827_55%,#172554)] dark:text-white">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200/70 bg-white/68 px-4 py-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/58 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/15 text-cyan-700 dark:text-cyan-200">
            <Activity className="size-5" />
          </span>
          <span className="text-lg font-bold">PulseBoard</span>
        </Link>

        <nav className="mt-8 grid gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
                  active &&
                    "bg-cyan-300/18 text-cyan-800 dark:text-cyan-100",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-cyan-300/25 bg-cyan-300/12 p-4">
          <p className="text-sm font-bold">Workspace Pro</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Create, organize, and present with a secure PulseBoard account.
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <nav className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60">
          <div className="flex h-16 w-full items-center justify-between px-5">
            <Link href="/dashboard" className="flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/15 text-cyan-700 dark:text-cyan-200">
                <Activity className="size-5" />
              </span>
              <span className="font-bold">PulseBoard</span>
            </Link>

            <div className="hidden lg:block">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Workspace
              </p>
              <p className="text-sm font-semibold">
                {identityLabel ?? email}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/profile">
                  <UserRound className="size-4" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>
              </Button>
              <ThemeToggle />
              <Button type="button" variant="danger" size="sm" onClick={signOut}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </nav>

        <nav className="border-b border-slate-200/70 bg-white/55 px-3 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40 lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {navItems.slice(0, 4).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-600 dark:text-slate-300",
                  pathname === item.href &&
                    "bg-cyan-300/18 text-cyan-800 dark:text-cyan-100",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </main>
  );
}
