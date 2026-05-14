import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getUserDisplayName, getUserIdentityLabel } from "@/lib/user";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName = getUserDisplayName(user);

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      identityLabel={getUserIdentityLabel(user)}
    >
      <div className="rounded-lg border border-slate-200/75 bg-white/75 p-6 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/15 text-cyan-700 dark:text-cyan-200">
            <UserRound className="size-9" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
              Profile
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal">
              {displayName}
            </h1>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-950/35">
            <Mail className="size-5 text-cyan-700 dark:text-cyan-200" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Email
            </p>
            <p className="mt-1 font-semibold">{user.email}</p>
          </div>
          <div className="rounded-md border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-950/35">
            <ShieldCheck className="size-5 text-cyan-700 dark:text-cyan-200" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              User ID
            </p>
            <p className="mt-1 break-all font-mono text-sm">{user.id}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
