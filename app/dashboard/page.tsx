import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardWorkspace } from "@/components/dashboard-workspace";
import type { PresentationRecord } from "@/lib/presentations";
import { createClient } from "@/lib/supabase/server";
import { getUserIdentityLabel } from "@/lib/user";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: presentations } = await supabase
    .from("presentations")
    .select("id,user_id,title,slides,updated_at,created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .returns<PresentationRecord[]>();

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      identityLabel={getUserIdentityLabel(user)}
    >
      <DashboardWorkspace
        email={user.email ?? "teammate"}
        presentations={presentations ?? []}
      />
    </AppShell>
  );
}

