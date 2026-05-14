import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RealtimePoll } from "@/components/realtime-poll";
import { defaultPollSession, type PollSession } from "@/lib/polls";
import { createClient } from "@/lib/supabase/server";
import { getUserIdentityLabel } from "@/lib/user";

export default async function PollHostPage({
  params,
}: {
  params: Promise<{ pollId: string }>;
}) {
  const { pollId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("poll_sessions")
    .select("id,question,options,locked,created_by,updated_at")
    .eq("id", pollId)
    .maybeSingle<PollSession>();

  return (
    <AppShell
      email={user.email ?? "Signed in"}
      identityLabel={getUserIdentityLabel(user)}
    >
      <RealtimePoll
        mode="host"
        initialSession={
          data ?? {
            ...defaultPollSession,
            id: pollId,
            created_by: user.id,
          }
        }
        userId={user.id}
      />
    </AppShell>
  );
}
