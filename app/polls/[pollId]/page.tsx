import { RealtimePoll } from "@/components/realtime-poll";
import { defaultPollSession, type PollSession } from "@/lib/polls";
import { createClient } from "@/lib/supabase/server";

export default async function PollAudiencePage({
  params,
}: {
  params: Promise<{ pollId: string }>;
}) {
  const { pollId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("poll_sessions")
    .select("id,question,options,locked,created_by,updated_at")
    .eq("id", pollId)
    .maybeSingle<PollSession>();

  return (
    <RealtimePoll
      mode="audience"
      initialSession={data ?? { ...defaultPollSession, id: pollId }}
    />
  );
}
