"use client";

import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Copy,
  Lock,
  Radio,
  RefreshCw,
  Save,
  Unlock,
  UsersRound,
  Vote,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countVotes,
  type PollOption,
  type PollSession,
  type PollVote,
} from "@/lib/polls";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function getParticipantId(pollId: string) {
  const key = `pulseboard-poll-${pollId}-participant`;
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

export function RealtimePoll({
  initialSession,
  mode,
  userId,
}: {
  initialSession: PollSession;
  mode: "audience" | "host";
  userId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const votesChannelRef = useRef<RealtimeChannel | null>(null);
  const [session, setSession] = useState(initialSession);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [participantId] = useState(() =>
    typeof window === "undefined" ? "" : getParticipantId(initialSession.id),
  );
  const [participants, setParticipants] = useState(1);
  const [status, setStatus] = useState("Ready");
  const audienceUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/polls/${session.id}`;

  const chartData = useMemo(
    () => countVotes(session.options, votes),
    [session.options, votes],
  );
  const totalVotes = votes.length;

  useEffect(() => {
    const id = participantId || getParticipantId(session.id);
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    async function loadVotes() {
      try {
        const { data } = await supabase
          .from("poll_votes")
          .select("poll_id,participant_id,option_id,created_at")
          .eq("poll_id", session.id)
          .returns<PollVote[]>();

        if (isMounted && Array.isArray(data)) {
          setVotes(data);
          setSelectedOption(
            data.find((vote) => vote.participant_id === id)?.option_id ?? "",
          );
        }
      } catch (error) {
        if (isMounted) {
          console.debug("Vote polling error:", error);
        }
      }
    }

    async function loadSession() {
      try {
        const { data } = await supabase
          .from("poll_sessions")
          .select("id,question,options,locked,created_by,updated_at")
          .eq("id", session.id)
          .maybeSingle<PollSession>();

        if (isMounted && data) {
          setSession(data);
        }
      } catch (error) {
        // Silently handle errors in polling - the component will continue functioning
        if (isMounted) {
          console.debug("Session polling error:", error);
        }
      }
    }

    void loadVotes();
    void loadSession();

    const votesChannel = supabase
      .channel(`poll-votes-${session.id}`)
      .on("broadcast", { event: "vote-change" }, async () => {
        await loadVotes();
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poll_votes",
          filter: `poll_id=eq.${session.id}`,
        },
        async () => {
          await loadVotes();
        },
      )
      .subscribe();
    votesChannelRef.current = votesChannel;

    const sessionChannel = supabase
      .channel(`poll-session-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poll_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.new && isMounted) {
            setSession(payload.new as PollSession);
          }
        },
      )
      .subscribe();

    const presenceChannel = supabase.channel(`poll-presence-${session.id}`, {
      config: {
        presence: {
          key: id,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        if (isMounted) {
          setParticipants(Object.keys(state).length);
        }
      })
      .subscribe(async (subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            mode,
          });
        }
      });

    // Aggressive polling: refresh votes every 500ms for true realtime chart updates
    pollInterval = setInterval(async () => {
      await loadVotes();
      await loadSession();
    }, 500);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      votesChannelRef.current = null;
      void supabase.removeChannel(votesChannel);
      void supabase.removeChannel(sessionChannel);
      void supabase.removeChannel(presenceChannel);
    };
  }, [mode, participantId, session.id, supabase]);

  async function submitVote() {
    if (session.locked) {
      setStatus("Voting is locked");
      return;
    }

    if (!selectedOption) {
      setStatus("Choose an option first");
      return;
    }

    setStatus("Submitting vote...");

    const optimisticVote = {
      poll_id: session.id,
      participant_id: participantId,
      option_id: selectedOption,
    };

    // Optimistic update
    setVotes((current) => [
      ...current.filter((vote) => vote.participant_id !== participantId),
      optimisticVote,
    ]);

    try {
      const { error } = await supabase.from("poll_votes").upsert(optimisticVote);
      
      if (error) {
        setStatus("Vote saved locally");
      } else {
        setStatus("Vote submitted ✓");
        // Broadcast to all subscribers
        await votesChannelRef.current?.send({
          type: "broadcast",
          event: "vote-change",
          payload: { pollId: session.id, voterId: participantId },
        });
      }
    } catch (err) {
      setStatus("Error submitting vote");
      console.error("Vote submission error:", err);
    }
  }

  async function saveSession(nextSession = session) {
    setStatus("Saving poll...");

    try {
      const { error } = await supabase.from("poll_sessions").upsert({
        id: nextSession.id,
        question: nextSession.question,
        options: nextSession.options,
        locked: nextSession.locked,
        created_by: userId ?? null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        setStatus("Poll saved locally");
      } else {
        setStatus("Poll saved ✓");
        // Broadcast poll changes to all clients
        await votesChannelRef.current?.send({
          type: "broadcast",
          event: "session-change",
          payload: { pollId: nextSession.id },
        });
      }
    } catch (err) {
      setStatus("Error saving poll");
      console.error("Save error:", err);
    }
  }

  function updateOption(optionId: string, label: string) {
    setSession((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === optionId ? { ...option, label } : option,
      ),
    }));
  }

  function addOption() {
    const nextOption: PollOption = {
      id: crypto.randomUUID(),
      label: `Option ${session.options.length + 1}`,
    };
    setSession((current) => ({
      ...current,
      options: [...current.options, nextOption],
    }));
  }

  function removeOption(optionId: string) {
    if (session.options.length <= 2) {
      return;
    }

    setSession((current) => ({
      ...current,
      options: current.options.filter((option) => option.id !== optionId),
    }));
  }

  async function toggleLock() {
    const nextSession = { ...session, locked: !session.locked };
    setSession(nextSession);
    await saveSession(nextSession);
  }

  async function resetVotes() {
    setVotes([]);
    setSelectedOption("");
    setStatus("Resetting votes...");
    
    try {
      const { error } = await supabase
        .from("poll_votes")
        .delete()
        .eq("poll_id", session.id);
      
      if (error) {
        setStatus("Votes reset locally");
      } else {
        setStatus("Votes reset ✓");
        // Broadcast to all subscribers
        await votesChannelRef.current?.send({
          type: "broadcast",
          event: "vote-change",
          payload: { pollId: session.id, action: "reset" },
        });
      }
    } catch (err) {
      setStatus("Error resetting votes");
      console.error("Reset error:", err);
    }
  }

  return (
    <main
      className={cn(
        "min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.18),transparent_30%),linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-950 dark:bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.16),transparent_30%),linear-gradient(135deg,#020617,#111827_55%,#172554)] dark:text-white",
        mode === "host" && "min-h-0 bg-none dark:bg-none",
      )}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <section className="rounded-lg border border-slate-200/75 bg-white/75 p-5 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
                <Radio className="size-4" />
                {mode === "host" ? "Host console" : "Audience vote"}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-5xl">
                {session.question}
              </h1>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/70 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-white/8">
              <UsersRound className="size-4 text-cyan-700 dark:text-cyan-200" />
              {participants} live
            </div>
          </div>

          {mode === "audience" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {session.options.map((option, index) => (
                <motion.button
                  key={option.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  whileHover={{ y: session.locked ? 0 : -4 }}
                  disabled={session.locked}
                  onClick={() => {
                    setSelectedOption(option.id);
                    setStatus("Selection ready");
                  }}
                  className={cn(
                    "min-h-28 rounded-lg border border-slate-200/80 bg-white/75 p-5 text-left shadow-lg transition dark:border-white/10 dark:bg-white/8",
                    selectedOption === option.id &&
                      "border-cyan-300/70 bg-cyan-300/16",
                    session.locked && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Option {index + 1}
                  </span>
                  <span className="mt-3 block text-xl font-bold">
                    {option.label}
                  </span>
                </motion.button>
              ))}
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  className="w-full"
                  disabled={session.locked || !selectedOption}
                  onClick={() => void submitVote()}
                >
                  <Vote className="size-4" />
                  Submit vote
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Question
                </label>
                <Input
                  value={session.question}
                  onChange={(event) =>
                    setSession((current) => ({
                      ...current,
                      question: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-3">
                {session.options.map((option, index) => (
                  <div key={option.id} className="flex gap-2">
                    <Input
                      value={option.label}
                      onChange={(event) =>
                        updateOption(option.id, event.target.value)
                      }
                      aria-label={`Option ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeOption(option.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={addOption}>
                  Add option
                </Button>
                <Button type="button" onClick={() => void saveSession()}>
                  <Save className="size-4" />
                  Save poll
                </Button>
                <Button type="button" variant="secondary" onClick={toggleLock}>
                  {session.locked ? (
                    <Unlock className="size-4" />
                  ) : (
                    <Lock className="size-4" />
                  )}
                  {session.locked ? "Unlock voting" : "Lock voting"}
                </Button>
                <Button type="button" variant="danger" onClick={resetVotes}>
                  <RefreshCw className="size-4" />
                  Reset votes
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside className="grid gap-5">
          <section className="rounded-lg border border-slate-200/75 bg-white/75 p-5 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Live results</h2>
              <span className="rounded-md bg-cyan-300/18 px-2 py-1 text-xs font-bold text-cyan-800 dark:text-cyan-100">
                {totalVotes} votes
              </span>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  key={totalVotes}
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={140}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="votes"
                    fill="#67e8f9"
                    radius={[0, 8, 8, 0]}
                    animationDuration={450}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200/75 bg-white/75 p-5 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
            <h2 className="text-xl font-bold">Poll status</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-950/35">
                <span>Voting</span>
                <span className="font-bold">
                  {session.locked ? "Locked" : "Open"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-950/35">
                <span>Realtime</span>
                <span className="font-bold">{status}</span>
              </div>
            </div>

            {mode === "host" ? (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Audience link
                </p>
                <div className="flex gap-2">
                  <Input value={audienceUrl} readOnly />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => navigator.clipboard.writeText(audienceUrl)}
                    aria-label="Copy audience link"
                    title="Copy audience link"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/12 px-3 py-3 text-sm font-semibold text-cyan-800 dark:text-cyan-100">
                <Vote className="size-4" />
                Anonymous voting enabled
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
