"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Loader2,
  Plus,
  Play,
  Lock,
  RefreshCw,
  Trash2,
  Copy,
  UsersRound,
  BarChart3,
  HelpCircle,
  Radio,
  X,
  Share2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/app-shell";
import type { Session, Question, Response } from "@/lib/schema";
import * as clientDb from "@/lib/clientDb";
import { subscribeToSession, broadcastSessionEvent } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

export default function HostConsolePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string>("power-user");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1000);

  const scale = useMemo(() => {
    if (windowWidth >= 768) return 1;
    return Math.max(0.4, (windowWidth - 48) / 720);
  }, [windowWidth]);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [participantsCount, setParticipantsCount] = useState<number>(0);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [questionResponseCounts, setQuestionResponseCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const [newPrompt, setNewPrompt] = useState("");
  const [newType, setNewType] = useState<"multiple_choice" | "word_cloud">("multiple_choice");
  const [mcOptions, setMcOptions] = useState<string[]>(["Option 1", "Option 2"]);

  const getAudienceUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/session/${code}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getAudienceUrl());
    setActionMessage("Copied share link to clipboard!");
    setTimeout(() => setActionMessage(""), 2000);
  };

  const handleActivateSession = async () => {
    if (!session) return;
    try {
      await clientDb.updateSessionStatus(session.id, "active");
      setSession((current) => (current ? { ...current, status: "active" } as Session : null));
      await broadcastSessionEvent(code, {
        type: "session_status",
        payload: { status: "active" },
      });
      setActionMessage("Session activated successfully!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setActionMessage(`Error: ${err.message || "Failed to activate session"}`);
      setTimeout(() => setActionMessage(""), 4000);
    }
  };

  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const handleLaunchSelected = async () => {
    if (!session || selectedQuestionIds.length === 0) return;
    try {
      await clientDb.setQuestionsLive(session.id, selectedQuestionIds);
      
      setQuestions((current) =>
        current.map((q) => ({ ...q, is_live: selectedQuestionIds.includes(q.id) }))
      );

      // Focus on the first of the active questions
      const liveList = questions.filter(q => selectedQuestionIds.includes(q.id));
      const target = liveList[0] || null;
      setActiveQuestion(target);
      setResponses([]);
      setParticipantsCount(0);

      // Reset selection checkbox array
      setSelectedQuestionIds([]);

      if (target) {
        void reloadResponses(target.id);
      }

      setActionMessage("Grouped questions launched live!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to launch selected questions:", err);
    }
  };

  const handleSaveTitle = async () => {
    if (!session || !editTitle.trim()) return;
    try {
      await clientDb.updateSessionTitle(session.id, editTitle.trim());
      setSession((current) => (current ? { ...current, title: editTitle.trim() } as Session : null));
      setActionMessage("Title updated successfully!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to update session title:", err);
      setActionMessage("Failed to save title.");
      setTimeout(() => setActionMessage(""), 2000);
    }
  };

  const handleMoveQuestion = async (index: number, direction: "up" | "down") => {
    if (!session) return;
    const nextQuestions = [...questions];
    const swapTarget = direction === "up" ? index - 1 : index + 1;
    if (swapTarget < 0 || swapTarget >= questions.length) return;

    // Swap locally (optimistic)
    const temp = nextQuestions[index];
    nextQuestions[index] = nextQuestions[swapTarget];
    nextQuestions[swapTarget] = temp;
    setQuestions(nextQuestions);

    try {
      const ids = nextQuestions.map((q) => q.id);
      await clientDb.reorderQuestions(session.id, ids);
      setActionMessage("Reordered successfully!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to reorder:", err);
      // Revert from server state on failure
      void loadHostData();
    }
  };

  const handleToggleSessionStatus = async () => {
    if (!session) return;
    const nextStatus = session.status === "active" ? "inactive" : "active";
    try {
      await clientDb.updateSessionStatus(session.id, nextStatus);
      setSession((current) => (current ? { ...current, status: nextStatus } as Session : null));
      await broadcastSessionEvent(code, {
        type: "session_status",
        payload: { status: nextStatus },
      });
      setActionMessage(`Session ${nextStatus === "active" ? "activated" : "deactivated"} successfully!`);
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setActionMessage(`Error: ${err.message || "Failed to update status"}`);
      setTimeout(() => setActionMessage(""), 4000);
    }
  };

  const loadHostData = async () => {
    try {
      // Direct client auth and approval check
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await clientDb.syncUserProfile(user.id, user.email || "");
        setUserRole(profile.role);
        if (profile.approval_status === "pending") {
          router.push("/awaiting-approval");
          return;
        }
      } else {
        // Safe check for local mock fallback testing
        const profile = await clientDb.syncUserProfile("demo-user-id", "vinay1979@gmail.com");
        setUserRole(profile.role);
        if (profile.approval_status === "pending") {
          router.push("/awaiting-approval");
          return;
        }
      }

      const activeSession = await clientDb.getSessionByCode(code);
      if (!activeSession) {
        setLoading(false);
        return;
      }
      setSession(activeSession);
      setEditTitle(activeSession.title);

      const dbQuestions = await clientDb.getQuestions(activeSession.id);
      setQuestions(dbQuestions);

      // Fetch response counts for each question in parallel
      const countsPromises = dbQuestions.map(async (q) => {
        const resps = await clientDb.getResponses(q.id);
        return { questionId: q.id, count: resps.length };
      });
      const counts = await Promise.all(countsPromises);
      const countsMap: Record<string, number> = {};
      counts.forEach((c) => {
        countsMap[c.questionId] = c.count;
      });
      setQuestionResponseCounts(countsMap);

      const currentLive = dbQuestions.find((q) => q.is_live);
      setActiveQuestion(currentLive ?? null);

      if (currentLive) {
        const dbResponses = await clientDb.getResponses(currentLive.id);
        setResponses(dbResponses);

        const uniqueParticipants = new Set(dbResponses.map((r) => r.participant_id)).size;
        setParticipantsCount(uniqueParticipants);
      } else {
        setResponses([]);
        setParticipantsCount(0);
      }
    } catch (err) {
      console.error("Error loading host console:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeQuestionRef = useRef<Question | null>(null);
  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    void loadHostData();

    const subscription = subscribeToSession(code, (event) => {
      console.log("Host Console received realtime event:", event);
      
      const currentActive = activeQuestionRef.current;
      if (event.type === "response_submitted") {
        if (currentActive && event.payload.questionId === currentActive.id) {
          void reloadResponses(currentActive.id);
        }
        // Dynamically increment the response count for this question
        setQuestionResponseCounts((prev) => ({
          ...prev,
          [event.payload.questionId]: (prev[event.payload.questionId] || 0) + 1,
        }));
      }
    });

    const pollInterval = setInterval(() => {
      const currentActive = activeQuestionRef.current;
      if (currentActive) {
        void reloadResponses(currentActive.id);
      }
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [code]);

  const reloadResponses = async (questionId: string) => {
    try {
      const dbResponses = await clientDb.getResponses(questionId);
      setResponses((current) => {
        if (JSON.stringify(current) !== JSON.stringify(dbResponses)) {
          return dbResponses;
        }
        return current;
      });
      const uniqueParticipants = new Set(dbResponses.map((r) => r.participant_id)).size;
      setParticipantsCount(uniqueParticipants);
    } catch (err) {
      // Background quiet fail
    }
  };

  const addOptionInput = () => {
    if (mcOptions.length >= 6) return;
    setMcOptions([...mcOptions, `Option ${mcOptions.length + 1}`]);
  };

  const removeOptionInput = (index: number) => {
    if (mcOptions.length <= 2) return;
    setMcOptions(mcOptions.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...mcOptions];
    updated[index] = val;
    setMcOptions(updated);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newPrompt.trim() || submittingQuestion) return;

    setSubmittingQuestion(true);

    try {
      const created = await clientDb.createQuestion(
        session.id,
        newType,
        newPrompt,
        newType === "multiple_choice" ? mcOptions : []
      );

      setQuestions((current) => [...current, created]);
      setNewPrompt("");
      setMcOptions(["Option 1", "Option 2"]);

      const updatedQuestions = await clientDb.getQuestions(session.id);
      const currentLive = updatedQuestions.find((q) => q.is_live);
      if (currentLive?.id === created.id) {
        setActiveQuestion(currentLive);
        setResponses([]);
        setParticipantsCount(0);
        await broadcastSessionEvent(code, {
          type: "question_live",
          payload: { questionId: currentLive.id },
        });
      }

      setActionMessage("New question added!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleSetQuestionLive = async (questionId: string) => {
    if (!session) return;
    try {
      await clientDb.setQuestionLive(session.id, questionId);
      
      setQuestions((current) =>
        current.map((q) => ({ ...q, is_live: q.id === questionId }))
      );

      const target = questions.find((q) => q.id === questionId) || null;
      setActiveQuestion(target);
      setResponses([]);
      setParticipantsCount(0);

      await broadcastSessionEvent(code, {
        type: "question_live",
        payload: { questionId },
      });

      if (target) {
        void reloadResponses(questionId);
      }

      setActionMessage(`Question now LIVE!`);
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetResponses = async () => {
    if (!activeQuestion) return;
    if (!confirm("Are you sure you want to delete all participant responses for this question?")) return;

    try {
      await clientDb.resetResponses(activeQuestion.id);
      setResponses([]);
      setParticipantsCount(0);

      await broadcastSessionEvent(code, {
        type: "responses_reset",
        payload: { questionId: activeQuestion.id },
      });

      setActionMessage("Responses reset successfully!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Delete this question? This will permanently remove its responses.")) return;

    try {
      await clientDb.deleteQuestion(questionId);
      setQuestions((current) => current.filter((q) => q.id !== questionId));

      if (activeQuestion?.id === questionId) {
        setActiveQuestion(null);
        setResponses([]);
        setParticipantsCount(0);
        await broadcastSessionEvent(code, {
          type: "question_live",
          payload: { questionId: "none" },
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const chartData = useMemo(() => {
    if (!activeQuestion || activeQuestion.type !== "multiple_choice") return [];
    
    const counts = activeQuestion.options.map((opt, idx) => ({
      name: opt,
      votes: 0,
    }));

    responses.forEach((res) => {
      const val = res.value.trim();
      // Try parsing as index first
      const idx = parseInt(val);
      if (!Number.isNaN(idx) && idx >= 0 && idx < counts.length && String(idx) === val) {
        counts[idx].votes += 1;
      } else {
        // Otherwise, try matching by option text case-insensitively
        const foundIdx = activeQuestion.options.findIndex(
          (opt) => opt.trim().toLowerCase() === val.toLowerCase()
        );
        if (foundIdx !== -1) {
          counts[foundIdx].votes += 1;
        }
      }
    });

    return counts;
  }, [activeQuestion, responses]);

  const wordCloudWords = useMemo(() => {
    if (!activeQuestion || activeQuestion.type !== "word_cloud") return [];

    const freqMap: Record<string, number> = {};
    responses.forEach((res) => {
      const word = res.value.trim();
      if (word === "") return;
      const key = word.toLowerCase();
      
      if (!freqMap[key]) {
        freqMap[key] = 0;
      }
      freqMap[key] += 1;
    });

    const sortedWords = Object.entries(freqMap).map(([key, count]) => {
      const original = responses.find((r) => r.value.toLowerCase() === key)?.value || key;
      return { text: original, count };
    });

    const list = sortedWords.sort((a, b) => b.count - a.count);

    // Lay out words in a beautiful Archimedean spiral centered at (0, 0)
    return list.map((word, index) => {
      const angle = index * 2.4; // Golden angle spiral spread
      const radius = index * 30 + 15; // Spread radius
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return {
        ...word,
        x,
        y,
      };
    });
  }, [activeQuestion, responses]);

  const getWordColor = (index: number) => {
    const colors = [
      "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.2)]",
      "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.2)]",
      "text-violet-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.2)]",
      "text-fuchsia-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.2)]",
      "text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.2)]",
      "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]",
      "text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.2)]",
      "text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.2)]",
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-cyan-400" />
        <p className="mt-4 text-sm text-slate-400">Loading presenter console...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-extrabold text-red-500">Session Not Found</h1>
        <p className="text-slate-400 mt-2">
          The requested room pin is invalid or has expired.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </main>
    );
  }

  return (
    <AppShell email="Presenter Console" identityLabel={`Active Room Pin: ${code}`} role={userRole}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        
        {/* Presenter Actions Banner - Sleek Dark overlay */}
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-violet-500/5 opacity-20 pointer-events-none" />

          <div className="flex flex-wrap items-center gap-4 relative z-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 shadow-md">
              <Radio className="size-5 animate-pulse" />
            </span>
            <div>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                className="text-2xl font-black text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-cyan-400 focus:outline-none w-full max-w-xl transition-all duration-200"
                placeholder="Untitled Session"
              />
              <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                Participants: <span className="font-extrabold text-slate-200 flex items-center gap-1.5"><UsersRound className="size-4 text-cyan-400" /> {participantsCount} online</span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2.5 relative z-10">
            <Button
              onClick={handleToggleSessionStatus}
              className={`h-11 px-5 font-black flex items-center gap-2 cursor-pointer shadow-lg ${
                session.status === "active"
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                  : "bg-emerald-500 hover:bg-emerald-600 text-slate-950"
              }`}
            >
              <Radio className={`size-4 ${session.status === "active" ? "animate-pulse" : ""}`} />
              {session.status === "active" ? "Deactivate Session" : "Activate Session"}
            </Button>

            <Button onClick={handleCopyLink} variant="secondary" className="h-11 px-5 border border-white/5 bg-slate-950/40 hover:bg-slate-950 text-white font-bold flex items-center gap-2">
              <Share2 className="size-4 text-cyan-400" />
              Copy Join Link
            </Button>
            <Button asChild className="h-11 px-5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold flex items-center gap-2 group">
              <Link href={`/session/${code}`} target="_blank">
                Audience View
                <ExternalLink className="size-4 opacity-75 group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Warning Banner if Inactive */}
        {session.status === "inactive" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 border-2 border-amber-500/30 bg-amber-500/10 rounded-2xl p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-amber-500/5 to-transparent pointer-events-none" />
            <div className="flex items-start gap-3.5 z-10">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Lock className="size-5 shrink-0" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-amber-300">Room is Inactive</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Voters cannot join or submit answers while the room is inactive. Activate it now to let them in!
                </p>
              </div>
            </div>
            <div className="z-10">
              <Button
                onClick={handleActivateSession}
                className="h-11 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Radio className="size-4 animate-pulse" />
                Activate Session
              </Button>
            </div>
          </motion.div>
        )}

        {/* Real-time Status Alert */}
        <AnimatePresence>
          {actionMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 text-center text-sm font-extrabold rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-2.5 text-cyan-400 shadow-lg"
            >
              {actionMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          
          {/* LEFT: Live Results & Visualizations */}
          <div className="grid gap-6">
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

              <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    Live Stream Results
                    <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black text-cyan-400 border border-cyan-500/20 uppercase tracking-widest">
                      Code: {code}
                    </span>
                  </p>
                  <h2 className="text-2xl font-black mt-1 text-white whitespace-normal break-words leading-snug">
                    {activeQuestion ? activeQuestion.prompt_text : "No Live Question"}
                  </h2>
                </div>
                
                {activeQuestion && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleResetResponses}
                    className="h-9 py-0 px-3 flex items-center gap-1.5 font-bold cursor-pointer"
                    title="Reset Votes"
                  >
                    <RefreshCw className="size-3.5" />
                    Reset Votes
                  </Button>
                )}
              </div>

              <div className="relative z-10">
                {!activeQuestion ? (
                  <div className="h-96 flex flex-col items-center justify-center text-center">
                    <HelpCircle className="size-16 text-slate-700 animate-pulse mb-4" />
                    <h3 className="text-xl font-black text-slate-300">Screen is blank</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm">
                      Select a question from your questionnaire stack on the right and click "Launch" to start streaming results!
                    </p>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="h-96 flex flex-col items-center justify-center text-center">
                    <Loader2 className="size-10 text-cyan-400 animate-spin mb-4" />
                    <h3 className="text-xl font-black text-slate-300">Waiting for responses...</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm">
                      Streaming room is active. Give your audience the code <span className="font-extrabold text-cyan-400 tracking-wider">{code}</span> to submit their answers.
                    </p>
                  </div>
                ) : activeQuestion.type === "multiple_choice" ? (
                  /* Recharts horizontal dynamic bar chart */
                  <div className="h-96 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.03} />
                        <XAxis type="number" allowDecimals={false} stroke="#475569" tick={{ fill: "#64748b" }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={120}
                          tick={{ fill: "#e2e8f0", fontSize: 13, fontWeight: "bold" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#070a13",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "12px",
                            color: "#ffffff",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                          }}
                        />
                        <Bar
                          dataKey="votes"
                          fill="#06b6d4"
                          radius={[0, 8, 8, 0]}
                          animationDuration={500}
                          barSize={24}
                        >
                          <LabelList
                            dataKey="votes"
                            position="insideRight"
                            fill="#ffffff"
                            fontWeight="black"
                            fontSize={11}
                            offset={8}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  /* Custom Premium SVGs React + Framer Motion Word Cloud */
                  <div className="h-96 w-full border border-white/5 rounded-xl bg-slate-950/40 overflow-hidden relative shadow-inner flex items-center justify-center">
                    {wordCloudWords.map((word, index) => {
                      const fontSize = (16 + Math.min(word.count * 8, 48)) * scale; 
                      
                      return (
                        <span
                          key={word.text}
                          className={`font-black absolute tracking-tight select-none cursor-pointer py-1 px-3 rounded-lg transition duration-150 hover:bg-white/5 ${getWordColor(
                            index
                          )}`}
                          style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: "1.1",
                            left: `calc(50% + ${word.x * scale}px)`,
                            top: `calc(50% + ${word.y * scale}px)`,
                            transform: "translate(-50%, -50%)",
                          }}
                          title={`${word.count} entries`}
                        >
                          {word.text}
                          {word.count > 1 && (
                            <span className="text-[10px] align-super ml-1 opacity-70 bg-white/10 px-1.5 py-0.5 rounded-full font-extrabold">
                              x{word.count}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: Questionnaire Manager & Creator */}
          <div className="grid gap-6">
            
            {/* Create Question Stack Form */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative">
              <h3 className="text-lg font-black border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                <Plus className="size-4 text-cyan-400" />
                Add Question
              </h3>
              
              <form onSubmit={handleAddQuestion} className="mt-4 space-y-4 pr-1">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Question Type
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/5 bg-slate-950/45 p-1">
                    {(["multiple_choice", "word_cloud"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewType(type)}
                        className={`h-8 rounded text-xs font-bold capitalize transition cursor-pointer ${
                          newType === type
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {type === "multiple_choice" ? "Multiple Choice" : "Word Cloud"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="prompt" className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Question Prompt
                  </label>
                  <Input
                    id="prompt"
                    required
                    placeholder="e.g. Rate your confidence"
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    className="text-sm h-11 bg-slate-950/40 border-white/5 text-white"
                  />
                </div>

                {newType === "multiple_choice" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 flex justify-between items-center uppercase tracking-wider">
                      <span>Options (2 - 6 options)</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px] uppercase font-black text-cyan-400 hover:bg-cyan-400/10 cursor-pointer"
                        onClick={addOptionInput}
                        disabled={mcOptions.length >= 6}
                      >
                        + Add option
                      </Button>
                    </label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {mcOptions.map((opt, index) => (
                        <div key={index} className="flex gap-1.5 items-center">
                          <Input
                            id={`option-${index}`}
                            name={`option-${index}`}
                            aria-label={`Option ${index + 1}`}
                            required
                            placeholder={`Option ${index + 1}`}
                            value={opt}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            className="h-9 text-xs bg-slate-950/40 border-white/5 text-white"
                          />
                          <button
                            type="button"
                            onClick={() => removeOptionInput(index)}
                            disabled={mcOptions.length <= 2}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-30 cursor-pointer"
                            title="Remove Option"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 text-xs font-extrabold cursor-pointer" disabled={submittingQuestion}>
                  Save to Session Stack
                </Button>
              </form>
            </section>

            {/* Question Stack List */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative">
              <h3 className="text-lg font-black border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                <BarChart3 className="size-4 text-cyan-400" />
                Question Stack ({questions.length})
              </h3>

              {/* Grouped Launch Action Button */}
              {questions.length > 0 && (
                <div className="mt-4 mb-4">
                  <Button
                    type="button"
                    onClick={handleLaunchSelected}
                    disabled={selectedQuestionIds.length === 0}
                    className="w-full h-11 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
                  >
                    <Play className="size-4 text-slate-950" />
                    Launch Selected ({selectedQuestionIds.length})
                  </Button>
                </div>
              )}
              
              <div className="mt-2 space-y-3 max-h-80 overflow-y-auto pr-1">
                {questions.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    Session stack is empty. Create some questions above!
                  </p>
                ) : (
                  questions.map((q, index) => (
                    <div
                      key={q.id}
                      onClick={() => {
                        setActiveQuestion(q);
                        void reloadResponses(q.id);
                      }}
                      className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-all duration-200 cursor-pointer ${
                        activeQuestion?.id === q.id 
                          ? "border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-400/5" 
                          : q.is_live
                          ? "border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10"
                          : "border-white/5 bg-slate-950/20 hover:bg-slate-950/40"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex gap-3 items-start flex-1 min-w-0">
                          <input
                            type="checkbox"
                            id={`select-${q.id}`}
                            name={`select-${q.id}`}
                            aria-label={`Select Question ${index + 1}`}
                            className="mt-1 size-4 shrink-0 rounded border-white/10 bg-slate-950 accent-cyan-500 cursor-pointer"
                            checked={selectedQuestionIds.includes(q.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelectQuestion(q.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-block rounded-[4px] text-[9px] font-extrabold px-2 py-0.5 uppercase tracking-wider ${
                                q.is_live ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
                              }`}>
                                Q{index + 1} &middot; {q.type === "multiple_choice" ? "MC" : "Word"}
                              </span>
                              {q.is_live ? (
                                <span className="inline-block rounded-[4px] text-[9px] font-black px-2 py-0.5 uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                                  LIVE
                                </span>
                              ) : (questionResponseCounts[q.id] || 0) > 0 ? (
                                <span className="inline-block rounded-[4px] text-[9px] font-extrabold px-2 py-0.5 uppercase tracking-wider bg-slate-700/50 text-slate-300 border border-white/5">
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-block rounded-[4px] text-[9px] font-extrabold px-2 py-0.5 uppercase tracking-wider bg-slate-800/40 text-slate-500 border border-dashed border-white/5">
                                  Draft
                                </span>
                              )}
                            </div>
                            <h4 className="font-extrabold text-sm mt-1 text-slate-200 line-clamp-2">
                              {q.prompt_text}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(index, "up")}
                            disabled={index === 0}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(index, "down")}
                            disabled={index === questions.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteQuestion(q.id);
                            }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer shrink-0"
                            title="Delete Question"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface ExternalLinkProps extends React.SVGProps<SVGSVGElement> {}
function ExternalLink(props: ExternalLinkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
