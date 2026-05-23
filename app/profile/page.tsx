import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getUserDisplayName, getUserIdentityLabel } from "@/lib/user";
import { syncUserProfile } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/env";

export default async function ProfilePage() {
  let user = null;
  let displayName = "Vinay (vinay1979@gmail.com)";
  let email = "vinay1979@gmail.com";
  let identityLabel = "Developer (Local)";
  let role = "power-user";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      redirect("/login");
    }

    user = supabaseUser;
    email = user.email ?? "Signed in";
    displayName = getUserDisplayName(user);
    identityLabel = getUserIdentityLabel(user);

    try {
      const profile = await syncUserProfile(user.id, email);
      role = profile.role;
      if (profile.approval_status === "pending") {
        redirect("/awaiting-approval");
      }
    } catch (e) {
      console.error("Profile sync failed:", e);
    }
  } else {
    const profile = await syncUserProfile("demo-user-id", "vinay1979@gmail.com");
    role = profile.role;
    if (profile.approval_status === "pending") {
      redirect("/awaiting-approval");
    }
  }

  const resolvedUser = user || { id: "demo-user-id", email: "vinay1979@gmail.com" };

  return (
    <AppShell
      email={email}
      identityLabel={identityLabel}
      role={role}
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
            <p className="mt-1 font-semibold">{resolvedUser.email}</p>
          </div>
          <div className="rounded-md border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-950/35">
            <ShieldCheck className="size-5 text-cyan-700 dark:text-cyan-200" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              User ID
            </p>
            <p className="mt-1 break-all font-mono text-sm">{resolvedUser.id}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
