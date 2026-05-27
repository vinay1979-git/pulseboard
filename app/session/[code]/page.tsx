"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Loader2, Sparkles, Send, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Session, Question, Response } from "@/lib/schema";
import * as clientDb from "@/lib/clientDb";
import { subscribeToSession, broadcastSessionEvent } from "@/lib/realtime";

function getOrCreateParticipantId(sessionCode: string): string {
  if (typeof window === "undefined") return "";
  const key = `pulseboard-session-${sessionCode}-participant`;
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = `p-${crypto.randomUUID()}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}

export default function SessionAudiencePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [session, setSession] = useState<Session | null>(null);
  const [liveBatch, setLiveBatch] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const participantId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const key = `pulse-participant-${code}`;
    const stored = window.localStorage.getItem(key);
    if (stored) return stored;
    return getOrCreateParticipantId(code);
  }, [code]);

  const [selectedOption, setSelectedOption] = useState<string>("");
  const [wordValue, setWordValue] = useState<string>("");
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [sessionStatus, setSessionStatus] = useState<"active" | "inactive">("active");
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = liveBatch[currentQuestionIndex] || null;
  const isInputLocked = hasVoted || (timerSecondsLeft !== null && timerSecondsLeft <= 0);

  const loadData = async () => {
    try {
      const activeSession = await clientDb.getSessionByCode(code);
      if (!activeSession) {
        setError("Session not found.");
        setLoading(false);
        return;
      }

      // Auth Guard Redirect for Gmail Login Modes
      if (activeSession.auth_mode === "gmail" || activeSession.auth_mode === "quiz_gmail") {
        if (typeof window !== "undefined") {
          const storedParticipantId = window.localStorage.getItem(`pulse-participant-${code}`);
          if (!storedParticipantId) {
            router.push(`/session/${code}/login`);
            return;
          }
        }
      }

      setSession(activeSession);
      setSessionStatus(activeSession.status);

      if (activeSession.status === "inactive") {
        setLoading(false);
        return;
      }

      const questions = await clientDb.getQuestions(activeSession.id);
      const liveQuestions = questions.filter((q) => q.is_live);
      
      if (liveQuestions.length > 0) {
        setLiveBatch(liveQuestions);

        // Fetch vote status for each question in parallel
        const responsesPromises = liveQuestions.map(async (q) => {
          const res = await clientDb.getResponses(q.id);
          const alreadyVoted = res.some((r) => r.participant_id === participantId);
          return { questionId: q.id, alreadyVoted };
        });
        
        const voteStatuses = await Promise.all(responsesPromises);
        
        // Find the first unanswered question
        const firstUnvotedIndex = liveQuestions.findIndex((q) => {
          const status = voteStatuses.find((v) => v.questionId === q.id);
          return status ? !status.alreadyVoted : true;
        });

        if (firstUnvotedIndex !== -1) {
          setCurrentQuestionIndex(firstUnvotedIndex);
          setHasVoted(false);
        } else {
          // All questions in the live batch have been answered by this participant
          setCurrentQuestionIndex(0);
          setHasVoted(true);
        }
      } else {
        setLiveBatch([]);
        setCurrentQuestionIndex(0);
        setHasVoted(false);
      }
    } catch (err) {
      console.error("Error loading session:", err);
      setError("Failed to fetch session. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const liveBatchRef = useRef<Question[]>([]);
  useEffect(() => {
    liveBatchRef.current = liveBatch;
  }, [liveBatch]);

  useEffect(() => {
    void loadData();

    const subscription = subscribeToSession(code, (event) => {
      console.log("Audience received realtime event:", event);
      if (event.type === "question_live") {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setTimerSecondsLeft(null);
        setHasVoted(false);
        setSelectedOption("");
        setWordValue("");
        void loadData();
      } else if (event.type === "questions_timer_start") {
        const { duration } = event.payload;
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        setTimerSecondsLeft(duration);
        let timeLeft = duration;
        timerIntervalRef.current = setInterval(() => {
          timeLeft -= 1;
          setTimerSecondsLeft(timeLeft);
          if (timeLeft <= 0) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
          }
        }, 1000);
      } else if (event.type === "questions_timer_pause") {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      } else if (event.type === "questions_timer_resume") {
        const { duration } = event.payload;
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        setTimerSecondsLeft(duration);
        let timeLeft = duration;
        timerIntervalRef.current = setInterval(() => {
          timeLeft -= 1;
          setTimerSecondsLeft(timeLeft);
          if (timeLeft <= 0) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
          }
        }, 1000);
      } else if (event.type === "session_status") {
        setSessionStatus(event.payload.status);
        if (event.payload.status === "inactive") {
          setLiveBatch([]);
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setTimerSecondsLeft(null);
        } else {
          setHasVoted(false);
          setSelectedOption("");
          setWordValue("");
          void loadData();
        }
      } else if (event.type === "responses_reset") {
        const resetQuestionId = event.payload.questionId;
        const currentBatch = liveBatchRef.current;
        if (currentBatch.some((q) => q.id === resetQuestionId)) {
          setSelectedOption("");
          setWordValue("");
          void loadData();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [code]);

  const handleVoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || submitting) return;

    const answerValue = currentQuestion.type === "multiple_choice" ? selectedOption : wordValue.trim();
    if (answerValue === "") return;

    setSubmitting(true);

    try {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimerSecondsLeft(null);

      const storedParticipant = typeof window !== "undefined" ? window.localStorage.getItem(`pulse-participant-${code}`) : null;
      const response = await clientDb.submitResponse(currentQuestion.id, participantId, answerValue, storedParticipant);

      await broadcastSessionEvent(code, {
        type: "response_submitted",
        payload: {
          questionId: currentQuestion.id,
          response,
        },
      });

      setSelectedOption("");
      setWordValue("");

      // Sequentially advance or set completion state
      if (currentQuestionIndex + 1 < liveBatch.length) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        // Last question in the batch has been completed!
        setHasVoted(true);
      }
    } catch (err) {
      console.error("Failed to submit response:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
        <p className="mt-4 text-sm text-slate-400 animate-pulse">Loading live PulseRoom...</p>
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 text-center">
        <ShieldAlert className="size-16 text-red-500 mb-6" />
        <h1 className="text-3xl font-extrabold">{error}</h1>
        <p className="text-slate-400 mt-2 max-w-md">
          This PulseRoom might have been deleted, or the URL code is incorrect.
        </p>
        <Button asChild className="mt-6">
          <Link href="/join">Go to Join Portal</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,rgba(6,182,212,0.15),transparent_32%),linear-gradient(135deg,#070a13,#0f172a)] text-slate-100 flex flex-col justify-between px-4 py-6 sm:px-6">
      
      {/* Simple Navbar */}
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
            <Activity className="size-4 animate-pulse" />
          </span>
          <span className="text-sm font-black text-slate-200">{session?.title}</span>
        </div>
        <span className="rounded-full bg-cyan-400/10 border border-cyan-400/20 px-3.5 py-1 text-xs font-black tracking-widest text-cyan-400 uppercase">
          Pin: {code}
        </span>
      </nav>

      {/* Interactive Form Panel */}
      <div className="mx-auto w-full max-w-xl my-auto">
        <AnimatePresence mode="wait">
          {sessionStatus === "inactive" ? (
            /* 1. Session Inactive state */
            <motion.div
              key="inactive"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-8 text-center backdrop-blur-xl"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-slate-500 mb-4 border border-white/5">
                <Activity className="size-5" />
              </span>
              <h2 className="text-2xl font-black text-white">Waiting for Presenter</h2>
              <p className="mt-2 text-slate-400 text-sm">
                This presentation PulseRoom is currently closed. It will automatically load once the presenter activates the PulseRoom.
              </p>
            </motion.div>
          ) : liveBatch.length === 0 ? (
            /* 2. No live question state */
            <motion.div
              key="no-question"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center backdrop-blur-xl"
            >
              <Sparkles className="size-8 mx-auto text-cyan-400 animate-pulse" />
              <h2 className="mt-4 text-2xl font-black text-white">Connected to Lobby</h2>
              <p className="mt-2 text-slate-400 text-sm">
                Hang tight! The host is getting the presentation ready. When a question is made live, your screen will update instantly!
              </p>
            </motion.div>
          ) : hasVoted ? (
            /* 3. Voted - Waiting for next question screen */
            <motion.div
              key="voted"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.1, 1] }}
                transition={{ duration: 0.3 }}
              >
                <CheckCircle2 className="size-12 mx-auto text-emerald-400" />
              </motion.div>
              <h2 className="mt-4 text-2xl font-black text-emerald-400">Answer Received!</h2>
              <p className="mt-2 text-slate-400 text-sm">
                Thank you! Your feedback has been safely submitted. Please wait here for the presenter to launch the next question.
              </p>
              
              <div className="mt-6 flex justify-center gap-1.5">
                <span className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="h-2.5 w-2.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" />
              </div>
            </motion.div>
          ) : !currentQuestion ? null : (
            /* 4. Active Question submission form */
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 shadow-3xl shadow-slate-950/50 backdrop-blur-2xl relative"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">
                  {liveBatch.length > 1 
                    ? `Survey Mode · Question ${currentQuestionIndex + 1} of ${liveBatch.length}`
                    : `Live Question · ${currentQuestion.type === "multiple_choice" ? "Multiple Choice" : "Word Cloud"}`
                  }
                </span>
                
                {/* Visual survey progress dots / progress bar */}
                {liveBatch.length > 1 && (
                  <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                    {liveBatch.map((_, dotIdx) => (
                      <span
                        key={dotIdx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          dotIdx === currentQuestionIndex
                            ? "w-4 bg-cyan-400 animate-pulse"
                            : dotIdx < currentQuestionIndex
                            ? "w-2 bg-emerald-400"
                            : "w-2 bg-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Ticking Timer Countdown Banner */}
              {timerSecondsLeft !== null && (
                <div className={`mb-4 rounded-xl border p-4 text-center font-bold relative overflow-hidden transition-all duration-300 ${
                  timerSecondsLeft <= 5
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse"
                    : "bg-cyan-500/5 border-cyan-500/20 text-cyan-400"
                }`}>
                  <div className="absolute -inset-px rounded-xl bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest block opacity-70">
                    {timerSecondsLeft === 0 ? "Time is Up!" : "Time Remaining"}
                  </span>
                  <span className="text-3xl font-black mt-1 block">
                    {timerSecondsLeft}s
                  </span>
                </div>
              )}
              
              <h1 className="text-2xl sm:text-3.5xl font-black leading-tight text-white mb-6">
                {currentQuestion.prompt_text}
              </h1>

              <form onSubmit={handleVoteSubmit} className="space-y-6">
                {currentQuestion.type === "multiple_choice" ? (
                  /* Multiple Choice voting options with at least 44px (strictly 48px) touch heights */
                  <div className="grid gap-3">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOption(String(idx))}
                        disabled={isInputLocked || submitting}
                        className={`w-full text-left p-5 rounded-xl border text-base font-bold transition-all duration-200 flex justify-between items-center min-h-[52px] ${
                          isInputLocked
                            ? "opacity-50 cursor-not-allowed border-white/5 bg-slate-950/20 text-slate-500"
                            : selectedOption === String(idx)
                            ? "border-cyan-400 bg-cyan-400/10 text-white shadow-lg shadow-cyan-400/5 cursor-pointer"
                            : "border-white/5 bg-slate-950/30 text-slate-300 hover:bg-slate-950/50 cursor-pointer"
                        }`}
                      >
                        <span>{option}</span>
                        {selectedOption === String(idx) ? (
                          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-md shadow-cyan-400" />
                        ) : (
                          <span className="h-2 w-2 rounded-full border border-white/20" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="word-entry" className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Your response word
                    </label>
                    <Input
                      id="word-entry"
                      name="word-entry"
                      required
                      placeholder={timerSecondsLeft !== null && timerSecondsLeft <= 0 ? "Time's up!" : "Type your word here (e.g. Dynamic, Scalable...)"}
                      value={wordValue}
                      onChange={(e) => setWordValue(e.target.value.slice(0, 25))}
                      disabled={isInputLocked || submitting}
                      className="text-lg py-7 bg-slate-950/50 border-white/10 text-white font-semibold focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      autoFocus
                    />
                    <p className="text-[10px] font-bold text-slate-500 text-right uppercase tracking-wider">
                      Max 25 characters
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-sm font-extrabold bg-cyan-500 hover:bg-cyan-600 text-slate-950 flex items-center justify-center gap-2 group shadow-lg shadow-cyan-500/10 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                  disabled={submitting || isInputLocked || (currentQuestion.type === "multiple_choice" ? selectedOption === "" : wordValue.trim() === "")}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting answer...
                    </>
                  ) : (
                    <>
                      Submit Answer
                      <Send className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 py-3 mt-4">
        PulseBoard Anonymous Signal System
      </footer>
    </main>
  );
}
