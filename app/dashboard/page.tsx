import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import { createClient } from "@/lib/supabase/server";
import { getUserIdentityLabel } from "@/lib/user";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessions, syncUserProfile } from "@/lib/db";
import type { Session } from "@/lib/schema";

export default async function DashboardPage() {
  let user = null;
  let identityLabel = "Developer (Local)";
  let email = "vinay1979@gmail.com";
  let displayName = "Vinay (vinay1979@gmail.com)";
  let sessions: Session[] = [];
  let userId = "demo-user-id";
  let role = "power-user";

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();

      if (!supabaseUser) {
        redirect("/login");
      }

      user = supabaseUser;
      email = user.email ?? "Signed in";
      identityLabel = getUserIdentityLabel(user);

      const fullName = user.user_metadata?.full_name;
      displayName = fullName ? `${fullName} (${email})` : email;
      userId = user.id;

      // Sync and retrieve User Profile
      const profile = await syncUserProfile(userId, email);
      role = profile.role;
      
      // Strict Authorization Guard check
      if (profile.approval_status === "pending") {
        redirect("/awaiting-approval");
      }

      sessions = await getSessions(user.id, role === "super-admin");
    } catch (e) {
      console.error("Dashboard auth check failed, using local mock:", e);
      sessions = await getSessions("demo-user-id", true); // Local default is super-admin Vinay
    }
  } else {
    // Local Fallback User
    const profile = await syncUserProfile("demo-user-id", "vinay1979@gmail.com");
    role = profile.role;
    if (profile.approval_status === "pending") {
      redirect("/awaiting-approval");
    }
    sessions = await getSessions("demo-user-id", role === "super-admin");
  }

  return (
    <AppShell email={email} identityLabel={identityLabel} role={role}>
      <DashboardWorkspace email={email} displayName={displayName} initialSessions={sessions} userId={userId} />
    </AppShell>
  );
}
