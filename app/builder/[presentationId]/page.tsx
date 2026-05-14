import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PresentationBuilder } from "@/components/presentation-builder";
import { defaultSlides, type PresentationRecord } from "@/lib/presentations";
import { createClient } from "@/lib/supabase/server";
import { getUserIdentityLabel } from "@/lib/user";

export default async function BuilderDetailPage({
  params,
}: {
  params: Promise<{ presentationId: string }>;
}) {
  const { presentationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("presentations")
    .select("id,user_id,title,slides,updated_at,created_at")
    .eq("id", presentationId)
    .eq("user_id", user.id)
    .maybeSingle<PresentationRecord>();

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      identityLabel={getUserIdentityLabel(user)}
    >
      <PresentationBuilder
        userId={user.id}
        email={user.email ?? "teammate"}
        presentationId={presentationId}
        initialTitle={data?.title ?? "Untitled presentation"}
        initialSlides={data?.slides?.length ? data.slides : defaultSlides}
      />
    </AppShell>
  );
}
