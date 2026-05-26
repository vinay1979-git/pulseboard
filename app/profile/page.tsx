import { Mail, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AvatarUpload } from "@/components/avatar-upload";
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
  let avatarUrl = null;

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
      avatarUrl = profile.avatar_url;
      if (profile.approval_status === "pending") {
        redirect("/awaiting-approval");
      }
    } catch (e) {
      console.error("Profile sync failed:", e);
    }
  } else {
    const profile = await syncUserProfile("demo-user-id", "vinay1979@gmail.com");
    role = profile.role;
    avatarUrl = profile.avatar_url;
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
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-transparent pointer-events-none" />
        
        {/* Avatar Upload Grid Section */}
        <div className="relative z-10">
          <AvatarUpload userId={resolvedUser.id} email={email} initialAvatarUrl={avatarUrl} />
        </div>

        <hr className="my-8 border-white/5 relative z-10" />

        <div className="relative z-10">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              Identity Card
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-white">
              {displayName}
            </h1>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-slate-950/40 p-5 relative overflow-hidden">
              <Mail className="size-5 text-cyan-400" />
              <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Email
              </p>
              <p className="mt-1.5 font-bold text-slate-200 text-sm">{resolvedUser.email}</p>
            </div>
            
            <div className="rounded-xl border border-white/5 bg-slate-950/40 p-5 relative overflow-hidden">
              <ShieldCheck className="size-5 text-cyan-400" />
              <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                User ID
              </p>
              <p className="mt-1.5 break-all font-mono text-xs text-slate-300">{resolvedUser.id}</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
