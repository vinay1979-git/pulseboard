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
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  Trophy,
  Medal,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
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

const CustomYAxisTick = ({ x, y, payload, index, activeQuestion }: any) => {
  if (!activeQuestion) return null;
  const isQuiz = activeQuestion.correct_option !== null && activeQuestion.correct_option !== undefined;
  const optIndex = typeof index === "number" ? index : (activeQuestion.options?.indexOf(payload?.value) ?? -1);
  const isCorrect = isQuiz && optIndex !== -1 && activeQuestion.correct_option === optIndex + 1;
  
  const fullText = payload?.value || "";
  
  // Strict character-based wrapping & truncation logic
  const cleanText = fullText.trim();
  let line1 = cleanText;
  let line2 = "";
  
  if (cleanText.length > 15) {
    line1 = cleanText.slice(0, 15);
    const remaining = cleanText.slice(15);
    
    if (remaining.length > 15) {
      // Truncate to 12 characters and append ellipsis
      line2 = remaining.slice(0, 12) + "...";
    } else {
      line2 = remaining;
    }
  }

  const hasTwoLines = line2 !== "";

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{fullText}</title>
      <text
        x={-10}
        y={hasTwoLines ? -2 : 4}
        textAnchor="end"
        fill="#e2e8f0"
        fontSize={hasTwoLines ? 12 : 13}
        fontWeight="bold"
        style={{ cursor: "help" }}
      >
        {hasTwoLines ? (
          <>
            <tspan x={-10} dy={0}>
              {isQuiz && optIndex !== -1 ? (isCorrect ? "✅ " : "❌ ") : ""}
              {line1}
            </tspan>
            <tspan x={-10} dy={14}>
              {line2}
            </tspan>
          </>
        ) : (
          <>
            {isQuiz && optIndex !== -1 ? (isCorrect ? "✅ " : "❌ ") : ""}
            {line1}
          </>
        )}
      </text>
    </g>
  );
};

export default function HostConsolePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string>("power-user");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1000);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullScreen = async () => {
    if (!workspaceRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await workspaceRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

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
  
  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const activeSessionRef = useRef<Session | null>(null);

  const reloadLeaderboard = async (sessId: string) => {
    try {
      const data = await clientDb.getParticipants(sessId);
      setLeaderboard(data);
    } catch (e) {
      console.error("Failed to load leaderboard:", e);
    }
  };
  
  // CSV Bulk Importer & Pagination states
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [showCsvImporter, setShowCsvImporter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Phase 2: Auto Launch & Manual Sequence states
  const [showAutoLaunchModal, setShowAutoLaunchModal] = useState(false);
  const [autoLaunchDuration, setAutoLaunchDuration] = useState<number>(30);
  const [autoLaunchError, setAutoLaunchError] = useState("");
  const [manualLaunchPointer, setManualLaunchPointer] = useState<number>(0);
  const [isAutoLaunchPaused, setIsAutoLaunchPaused] = useState<boolean>(false);
  const isAutoLaunchPausedRef = useRef(false);
  const [consoleMode, setConsoleMode] = useState<'idle' | 'manual' | 'auto' | 'bulk'>('idle');
  const [isAutoLaunchConfigExpanded, setIsAutoLaunchConfigExpanded] = useState<boolean>(false);
  
  useEffect(() => {
    isAutoLaunchPausedRef.current = isAutoLaunchPaused;
  }, [isAutoLaunchPaused]);

  // Phase 3: Real-time Participant metrics
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [attemptedCount, setAttemptedCount] = useState<number>(0);

  const questionsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(questions.length / questionsPerPage));
  
  const paginatedQuestions = useMemo(() => {
    const startIdx = (currentPage - 1) * questionsPerPage;
    return questions.slice(startIdx, startIdx + questionsPerPage);
  }, [questions, currentPage]);

  const liveQuestionsList = useMemo(() => questions.filter((q) => q.is_live), [questions]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [questions.length, totalPages, currentPage]);

  const [loading, setLoading] = useState(true);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);

  const handleToggleExpandQuestion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedQuestionIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const [newPrompt, setNewPrompt] = useState("");
  const [newType, setNewType] = useState<"multiple_choice" | "word_cloud">("multiple_choice");
  const [mcOptions, setMcOptions] = useState<string[]>(["Option 1", "Option 2"]);
  const [correctOption, setCorrectOption] = useState<number | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null);
  const [configuredDuration, setConfiguredDuration] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      setActionMessage("PulseRoom activated successfully!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setActionMessage(`Error: ${err.message || "Failed to activate PulseRoom"}`);
      setTimeout(() => setActionMessage(""), 4000);
    }
  };

  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const handleAutoLaunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || questions.length === 0) return;
    
    const parsedDuration = parseInt(autoLaunchDuration as any, 10) || 0;
    if (parsedDuration < 10 || parsedDuration > 300) {
      setAutoLaunchError("Timer duration must be between 10 and 300 seconds.");
      return;
    }
    
    setAutoLaunchError("");
    try {
      await clientDb.updateSessionAutoLaunch(session.id, true, parsedDuration);
      
      setSession(current => current ? { ...current, auto_launch: true, timer_seconds: parsedDuration } : null);
      setShowAutoLaunchModal(false);
      
      // Step 1: Set BOTH states to the validated input integer simultaneously before activating the countdown mode state
      setConfiguredDuration(parsedDuration);
      setTimeLeft(parsedDuration);
      setConsoleMode("auto");
      
      await handleSetQuestionLive(questions[0].id, parsedDuration);
      
      setActionMessage(`Auto-launch loop successfully triggered with ${parsedDuration}s timer!`);
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err: any) {
      console.error("Auto launch failed:", err);
      setAutoLaunchError(err.message || "Failed to configure auto launch.");
    }
  };

  const getManualLaunchButtonText = () => {
    if (questions.length === 0) return "Manual Launch";
    if (manualLaunchPointer === questions.length) return "Complete PulseRoom";
    
    const currentLive = questions.find(q => q.is_live);
    if (!currentLive && manualLaunchPointer === 0) return "Manual Launch";
    
    return "Launch next";
  };

  const handleStartManual = async () => {
    if (questions.length === 0 || !session) return;
    try {
      setConsoleMode("manual");
      await handleSetQuestionLive(questions[0].id);
      setManualLaunchPointer(1);
    } catch (err) {
      console.error("Failed to start manual sequence:", err);
    }
  };

  const handleStartAutoLaunch = async () => {
    if (!session || questions.length === 0) return;
    
    const parsedDuration = parseInt(autoLaunchDuration as any, 10) || 0;
    if (parsedDuration < 10 || parsedDuration > 300) {
      setActionMessage("Timer must be between 10 and 300s.");
      setTimeout(() => setActionMessage(""), 3000);
      return;
    }
    
    try {
      await clientDb.updateSessionAutoLaunch(session.id, true, parsedDuration);
      setSession(current => current ? { ...current, auto_launch: true, timer_seconds: parsedDuration } : null);
      
      setIsAutoLaunchConfigExpanded(false);
      
      // Step 1: Set BOTH states to the validated input integer simultaneously before activating the countdown mode state
      setConfiguredDuration(parsedDuration);
      setTimeLeft(parsedDuration);
      setConsoleMode("auto");
      
      await handleSetQuestionLive(questions[0].id, parsedDuration);
      
      setActionMessage(`Auto-launch loop successfully triggered with ${parsedDuration}s timer!`);
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err: any) {
      console.error("Auto launch failed:", err);
      setActionMessage(err.message || "Failed to configure auto launch.");
      setTimeout(() => setActionMessage(""), 3000);
    }
  };

  const handleEndAndCompleteManual = async () => {
    try {
      await handleMarkCompleted();
      setConsoleMode("idle");
      setManualLaunchPointer(0);
    } catch (err) {
      console.error("Failed to end manual mode:", err);
    }
  };

  const handleSkipAutoLaunch = async () => {
    if (!session || !activeQuestion) return;
    try {
      const currentQId = activeQuestion.id;
      
      // 1. Clear timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // 2. Mark completed in DB
      await clientDb.markQuestionsCompleted(session.id, [currentQId]);
      setQuestions((current) =>
        current.map((q) => q.id === currentQId ? { ...q, is_live: false, is_completed: true } : q)
      );

      // 3. Launch next or complete
      const latestQuestions = [...questions];
      const currentIdx = latestQuestions.findIndex(q => q.id === currentQId);
      if (currentIdx !== -1 && currentIdx + 1 < latestQuestions.length) {
        const nextQ = latestQuestions[currentIdx + 1];
        await handleSetQuestionLive(nextQ.id, configuredDuration);
      } else {
        // Reset session auto launch configuration in DB
        await clientDb.updateSessionAutoLaunch(session.id, false, 0);
        setSession(current => current ? { ...current, auto_launch: false, timer_seconds: 0 } : null);
        
        setTimerSecondsLeft(null);
        setTimeLeft(null);
        setIsAutoLaunchPaused(false);
        setActiveQuestion(null);
        setConsoleMode("idle");
        setActionMessage("Auto-launch sequence finished!");
        setTimeout(() => setActionMessage(""), 3000);
      }
    } catch (err) {
      console.error("Failed to skip auto launch:", err);
    }
  };

  const handleMarkAllBulkCompleted = async () => {
    try {
      await handleMarkCompleted();
      setConsoleMode("idle");
      setManualLaunchPointer(0);
    } catch (err) {
      console.error("Failed to complete bulk mode:", err);
    }
  };

  const handleManualLaunch = async () => {
    if (questions.length === 0 || !session) return;

    if (manualLaunchPointer === questions.length) {
      // "Complete PulseRoom" action
      try {
        const liveQuestionIds = questions.filter(q => q.is_live).map(q => q.id);
        if (liveQuestionIds.length > 0) {
          await clientDb.markQuestionsCompleted(session.id, liveQuestionIds);
          setQuestions((current) =>
            current.map((q) => liveQuestionIds.includes(q.id) ? { ...q, is_live: false, is_completed: true } : q)
          );
        }
        setActiveQuestion(null);
        setResponses([]);
        setParticipantsCount(0);
        setManualLaunchPointer(0);
        setConsoleMode("idle");
        setActionMessage("PulseRoom sequence completed!");
        setTimeout(() => setActionMessage(""), 2000);
      } catch (err) {
        console.error("Failed to complete PulseRoom:", err);
      }
      return;
    }

    // "Launch Next" or "Manual Launch" action
    try {
      const prevLiveQuestions = questions.filter(q => q.is_live);
      const prevLiveIds = prevLiveQuestions.map(q => q.id);
      
      // 1. Mark previously live questions as completed
      if (prevLiveIds.length > 0) {
        await clientDb.markQuestionsCompleted(session.id, prevLiveIds);
      }

      // 2. Launch the question at manualLaunchPointer
      const targetQuestion = questions[manualLaunchPointer];
      if (targetQuestion) {
        await handleSetQuestionLive(targetQuestion.id);
        
        // Optimistically set status locally
        setQuestions((current) =>
          current.map((q) => {
            if (q.id === targetQuestion.id) {
              return { ...q, is_live: true, is_completed: false };
            }
            if (prevLiveIds.includes(q.id)) {
              return { ...q, is_live: false, is_completed: true };
            }
            return q;
          })
        );
        
        // Increment pointer
        setManualLaunchPointer((prev) => prev + 1);
        setConsoleMode("manual");
      }
    } catch (err) {
      console.error("Manual launch sequence failed:", err);
    }
  };

  const handleMarkCompleted = async () => {
    if (!session) return;
    const liveQuestionIds = questions.filter(q => q.is_live).map(q => q.id);
    if (liveQuestionIds.length === 0) return;
    try {
      await clientDb.markQuestionsCompleted(session.id, liveQuestionIds);
      setQuestions((current) =>
        current.map((q) => liveQuestionIds.includes(q.id) ? { ...q, is_live: false, is_completed: true } : q)
      );
      
      setActiveQuestion((current) => current && liveQuestionIds.includes(current.id) ? { ...current, is_live: false, is_completed: true } : current);
      
      setActionMessage("Questions marked completed!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to mark completed:", err);
    }
  };

  const handleTogglePauseAutoLaunch = async () => {
    if (!session || !activeQuestion) return;
    const nextPaused = !isAutoLaunchPaused;
    setIsAutoLaunchPaused(nextPaused);

    try {
      if (nextPaused) {
        // Pause Broadcast
        await broadcastSessionEvent(code, {
          type: "questions_timer_pause",
          payload: { questionId: activeQuestion.id },
        });
        setActionMessage("Auto-launch timer PAUSED");
      } else {
        // Resume Broadcast
        await broadcastSessionEvent(code, {
          type: "questions_timer_resume",
          payload: { questionId: activeQuestion.id, duration: timerSecondsLeft || 0 },
        });
        setActionMessage("Auto-launch timer RESUMED");
      }
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to toggle pause:", err);
    }
  };

  const handleCancelAutoLaunch = async () => {
    if (!session) return;
    try {
      // 1. Reset auto launch configuration in DB
      await clientDb.updateSessionAutoLaunch(session.id, false, 0);
      setSession(current => current ? { ...current, auto_launch: false, timer_seconds: 0 } : null);

      // 2. Clear any local interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimerSecondsLeft(null);
      setTimeLeft(null);
      setIsAutoLaunchPaused(false);

      // 3. Complete current live question immediately
      if (activeQuestion) {
        await clientDb.markQuestionsCompleted(session.id, [activeQuestion.id]);
        setQuestions((current) =>
          current.map((q) => q.id === activeQuestion.id ? { ...q, is_live: false, is_completed: true } : q)
        );
        setActiveQuestion(null);
      }

      setConsoleMode("idle");
      setManualLaunchPointer(0);

      // 4. Broadcast timer cancel/pause event to participants
      await broadcastSessionEvent(code, {
        type: "questions_timer_pause",
        payload: { questionId: activeQuestion?.id || "none" },
      });

      setActionMessage("Auto-launch loop cancelled!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to cancel auto launch:", err);
    }
  };

  const handleLaunchSelected = async () => {
    if (!session || selectedQuestionIds.length === 0) return;
    try {
      await clientDb.setQuestionsLive(session.id, selectedQuestionIds);
      
      setQuestions((current) =>
        current.map((q) => ({ 
          ...q, 
          is_live: selectedQuestionIds.includes(q.id),
          is_completed: selectedQuestionIds.includes(q.id) ? false : q.is_completed
        }))
      );

      // Focus on the first of the active questions
      const liveList = questions.filter(q => selectedQuestionIds.includes(q.id));
      const target = liveList[0] || null;
      setActiveQuestion(target);
      setResponses([]);
      setParticipantsCount(0);

      // Reset selection checkbox array
      setSelectedQuestionIds([]);
      setConsoleMode("bulk");

      if (target) {
        const targetIdx = questions.findIndex(q => q.id === target.id);
        if (targetIdx !== -1) {
          setManualLaunchPointer(targetIdx + 1);
        }
        void reloadResponses(target.id);
      }

      setActionMessage("Grouped questions launched live!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to launch selected questions:", err);
    }
  };

  const handleLaunchAll = async () => {
    if (!session || questions.length === 0) return;
    try {
      const allQuestionIds = questions.map((q) => q.id);
      await clientDb.setQuestionsLive(session.id, allQuestionIds);
      
      setQuestions((current) =>
        current.map((q) => ({ ...q, is_live: true, is_completed: false }))
      );

      // Focus on the first question
      const target = questions[0] || null;
      setActiveQuestion(target);
      setResponses([]);
      setParticipantsCount(0);

      // Reset selection checkbox array
      setSelectedQuestionIds([]);

      setManualLaunchPointer(1);
      setConsoleMode("bulk");

      if (target) {
        void reloadResponses(target.id);
      }

      setActionMessage("All questions launched live simultaneously!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Failed to launch all questions:", err);
      setActionMessage("Failed to launch all questions.");
      setTimeout(() => setActionMessage(""), 2000);
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
      setActionMessage(`PulseRoom ${nextStatus === "active" ? "activated" : "deactivated"} successfully!`);
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err: any) {
      console.error(err);
      setActionMessage(`Error: ${err.message || "Failed to update status"}`);
      setTimeout(() => setActionMessage(""), 4000);
    }
  };

  const loadHostData = async () => {
    try {
      let activeRole = "power-user";
      let activeUserId = "demo-user-id";
      
      // Direct client auth and approval check
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        activeUserId = user.id;
        const profile = await clientDb.syncUserProfile(user.id, user.email || "");
        activeRole = profile.role;
        setUserRole(profile.role);
        if (profile.approval_status === "pending") {
          router.push("/awaiting-approval");
          return;
        }
      } else {
        // Safe check for local mock fallback testing
        const profile = await clientDb.syncUserProfile("demo-user-id", "vinay1979@gmail.com");
        activeRole = profile.role;
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
      
      // Console Bypass Check
      const isOwner = activeSession.created_by === activeUserId;
      const isSuperAdmin = activeRole === "super-admin";
      if (!isOwner && !isSuperAdmin) {
        router.push("/dashboard");
        return;
      }
      
      setSession(activeSession);
      activeSessionRef.current = activeSession;
      setEditTitle(activeSession.title);
      if (activeSession.auth_mode === "quiz_gmail") {
        void reloadLeaderboard(activeSession.id);
      }
      
      try {
        const attempted = await clientDb.getAttemptedParticipantsCount(activeSession.id);
        setAttemptedCount(attempted);
      } catch (e) {
        console.error("Failed to load initial attempted count:", e);
      }

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
        const liveIdx = dbQuestions.findIndex(q => q.id === currentLive.id);
        if (liveIdx !== -1) {
          setManualLaunchPointer(liveIdx + 1);
        }
        const dbResponses = await clientDb.getResponses(currentLive.id);
        setResponses(dbResponses);

        const uniqueParticipants = new Set(dbResponses.map((r) => r.participant_id)).size;
        setParticipantsCount(uniqueParticipants);
      } else {
        setResponses([]);
        setParticipantsCount(0);
      }

      // Derive initial consoleMode dynamically from active session state
      if (activeSession.auto_launch) {
        setConsoleMode("auto");
      } else {
        const liveCount = dbQuestions.filter((q) => q.is_live).length;
        if (liveCount > 1) {
          setConsoleMode("bulk");
        } else if (liveCount === 1) {
          setConsoleMode("manual");
        } else {
          setConsoleMode("idle");
        }
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

  const questionsRef = useRef<Question[]>([]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    activeSessionRef.current = session;
  }, [session]);

  const triggerNextQuestion = async () => {
    const target = activeQuestionRef.current;
    if (!target) return;
    
    // Lock input / calculate scores
    if (target && target.type === "multiple_choice" && target.correct_option) {
      try {
        await clientDb.calculateScores(target.id, target.correct_option);
      } catch (e) {
        console.error("Score calculation failed:", e);
      }
    }

    // Reset the timer to the timer_seconds baseline
    const baseline = parseInt(activeSessionRef.current?.timer_seconds as any, 10) || 0;
    setTimeLeft(baseline);

    // Transition questions: mark current completed and launch next
    void handleAutoProgress(target.id);
  };

  const activeQuestionId = activeQuestion?.id || null;
  const handleAutoProgression = () => {
    void triggerNextQuestion();
  };

  useEffect(() => {
    console.log(`[countdown useEffect] Mounted/Triggered: consoleMode=${consoleMode} timeLeft=${timeLeft} activeQuestionId=${activeQuestionId}`);
    if (consoleMode !== 'auto' || timeLeft === null) {
      console.log(`[countdown useEffect] Returning early: consoleMode !== auto or timeLeft === null`);
      return;
    }

    const intervalId = setInterval(() => {
      console.log(`[countdown useEffect tick] isPaused=${isAutoLaunchPausedRef.current}`);
      if (isAutoLaunchPausedRef.current) return;
      setTimeLeft((prevSeconds) => {
        console.log(`[countdown useEffect tick setTimeLeft] prevSeconds=${prevSeconds}`);
        if (prevSeconds === null) return null;
        // If time runs out, clear interval and advance the question
        if (prevSeconds <= 1) {
          console.log(`[countdown useEffect tick] Timer reached <= 1. Advancing!`);
          clearInterval(intervalId);
          handleAutoProgression();
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    return () => {
      console.log(`[countdown useEffect] Cleaning up intervalId: ${intervalId}`);
      clearInterval(intervalId);
    };
  }, [consoleMode, activeQuestionId, timeLeft === null]); // Depend on ID changes and active timer status to restart the interval natively

  useEffect(() => {
    setTimerSecondsLeft(timeLeft !== null && timeLeft > 0 ? timeLeft : null);
  }, [timeLeft]);

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
      } else if (event.type === "leaderboard-updated" || event.type === "leaderboard_updated") {
        const currentSess = activeSessionRef.current;
        if (currentSess) {
          void reloadLeaderboard(currentSess.id);
        }
      } else if (event.type === "presence_count") {
        setOnlineCount(event.payload.count);
      }
    });

    const pollInterval = setInterval(() => {
      const currentActive = activeQuestionRef.current;
      if (currentActive) {
        void reloadResponses(currentActive.id);
      }
      const currentSess = activeSessionRef.current;
      if (currentSess && currentSess.auth_mode === "quiz_gmail") {
        void reloadLeaderboard(currentSess.id);
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

      const currentSess = activeSessionRef.current;
      if (currentSess) {
        try {
          const attempted = await clientDb.getAttemptedParticipantsCount(currentSess.id);
          setAttemptedCount(attempted);
        } catch (e) {
          console.error("Failed to reload attempted count:", e);
        }
      }
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
    if (correctOption && correctOption > mcOptions.length - 1) {
      setCorrectOption(null);
    }
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
        newType === "multiple_choice" ? mcOptions : [],
        newType === "multiple_choice" && session.auth_mode === "quiz_gmail" ? correctOption : null
      );

      setQuestions((current) => [...current, created]);
      setNewPrompt("");
      setMcOptions(["Option 1", "Option 2"]);
      setCorrectOption(null);

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

  const handleAutoProgress = async (currentQId: string) => {
    if (!session) return;
    try {
      // 1. Mark current question as completed in DB
      await clientDb.markQuestionsCompleted(session.id, [currentQId]);
      
      // Update local state optimistically
      setQuestions((current) =>
        current.map((q) => q.id === currentQId ? { ...q, is_live: false, is_completed: true } : q)
      );

      const latestQuestions = [...questionsRef.current];
      const currentIdx = latestQuestions.findIndex(q => q.id === currentQId);
      
      if (currentIdx !== -1 && currentIdx + 1 < latestQuestions.length) {
        const nextQ = latestQuestions[currentIdx + 1];
        void handleSetQuestionLive(nextQ.id, configuredDuration);
      } else {
        // If final question finished, stop auto launch in DB
        await clientDb.updateSessionAutoLaunch(session.id, false, 0);
        setSession(current => current ? { ...current, auto_launch: false, timer_seconds: 0 } : null);
        
        setTimerSecondsLeft(null);
        setTimeLeft(null);
        setIsAutoLaunchPaused(false);
        setActiveQuestion(null);
        setConsoleMode("idle");
        
        setActionMessage("Quiz session completed!");
        setTimeout(() => setActionMessage(""), 3000);
      }
    } catch (err) {
      console.error("Auto progress failed to mark completed:", err);
    }
  };

  const handleSetQuestionLive = async (questionId: string, forceAutoDuration?: number) => {
    if (!session) return;
    try {
      // Clear any existing timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTimerSecondsLeft(null);
      setTimeLeft(null);

      await clientDb.setQuestionLive(session.id, questionId);
      
      setQuestions((current) =>
        current.map((q) => ({ 
          ...q, 
          is_live: q.id === questionId,
          is_completed: q.id === questionId ? false : q.is_completed
        }))
      );

      const target = questionsRef.current.find((q) => q.id === questionId) || null;
      setActiveQuestion(target);
      setResponses([]);
      setParticipantsCount(0);

      await broadcastSessionEvent(code, {
        type: "question_live",
        payload: { questionId },
      });

      if (target) {
        const targetIdx = questionsRef.current.findIndex(q => q.id === target.id);
        if (targetIdx !== -1) {
          setManualLaunchPointer(targetIdx + 1);
        }
        void reloadResponses(questionId);
      }

      setActionMessage(`Question now LIVE!`);
      setTimeout(() => setActionMessage(""), 2000);

      // Start Auto-Launch countdown timer
      const duration = forceAutoDuration !== undefined ? forceAutoDuration : (parseInt(session.timer_seconds as any, 10) || 0);
      const isAuto = forceAutoDuration !== undefined ? true : session.auto_launch;
      if (isAuto && duration > 0) {
        setTimerSecondsLeft(duration);
        setConfiguredDuration(duration);
        setTimeLeft(duration);

        // Broadcast timer start
        await broadcastSessionEvent(code, {
          type: "questions_timer_start",
          payload: { questionId, duration },
        });
      }
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

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;
    if (!confirm(`Delete ${selectedQuestionIds.length} selected question(s)? This will permanently remove their responses.`)) return;

    try {
      const deletePromises = selectedQuestionIds.map((id) => clientDb.deleteQuestion(id));
      await Promise.all(deletePromises);

      setQuestions((current) => current.filter((q) => !selectedQuestionIds.includes(q.id)));

      // If active question was deleted, reset it
      if (activeQuestion && selectedQuestionIds.includes(activeQuestion.id)) {
        setActiveQuestion(null);
        setResponses([]);
        setParticipantsCount(0);
        await broadcastSessionEvent(code, {
          type: "question_live",
          payload: { questionId: "none" },
        });
      }

      setSelectedQuestionIds([]);
      setActionMessage("Selected questions deleted successfully!");
      setTimeout(() => setActionMessage(""), 2000);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      setActionMessage("Bulk delete failed.");
      setTimeout(() => setActionMessage(""), 2000);
    }
  };

  const handleDownloadSampleCSV = () => {
    const isQuiz = session?.auth_mode === "quiz_gmail";
    const headers = "QNo, Question, Question Type, Option1, Option2, Option3, Option4, Option5, Option6, Option7, Option8, Answer\n";
    const sample1 = isQuiz
      ? "1, What is the capital of France?, QZ, Berlin, Paris, London, Rome,,,,, 2\n"
      : "1, Which UI frame do you prefer?, OP, Clean Cards, Glassmorphism Grid, Minimalist Row,,,,,\n";
    const sample2 = "2, Describe PulseBoard in one word, WC,,,,,,,,,\n";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + sample1 + sample2);
    
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "pulseboard_sample_questions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const parseCSV = (csvText: string) => {
        const lines = [];
        let row = [""];
        let insideQuote = false;
        for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];
          if (char === '"') {
            if (insideQuote && nextChar === '"') {
              row[row.length - 1] += '"';
              i++;
            } else {
              insideQuote = !insideQuote;
            }
          } else if (char === ',' && !insideQuote) {
            row.push("");
          } else if ((char === '\r' || char === '\n') && !insideQuote) {
            if (char === '\r' && nextChar === '\n') i++;
            lines.push(row);
            row = [""];
          } else {
            row[row.length - 1] += char;
          }
        }
        if (row.length > 1 || row[0] !== "") {
          lines.push(row);
        }
        return lines;
      };

      const rows = parseCSV(text);
      if (rows.length === 0) {
        setCsvErrors(["The uploaded CSV file is empty."]);
        return;
      }

      const dataRows = rows.slice(1).filter(r => r.length > 1 || (r[0] && r[0].trim() !== ""));
      if (dataRows.length === 0) {
        setCsvErrors(["No question rows found in the CSV file."]);
        return;
      }

      const errors: string[] = [];
      const parsedQuestions: any[] = [];
      let expectedQNo = 1;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;

        const qNoStr = row[0]?.trim();
        const promptText = row[1]?.trim();
        const qType = row[2]?.trim();

        if (!qNoStr || !promptText || !qType) {
          errors.push(`Row ${rowNum}: Missing mandatory fields (QNo, Question, or Question Type)`);
          continue;
        }

        const qNo = parseInt(qNoStr, 10);
        if (isNaN(qNo)) {
          errors.push(`Row ${rowNum}: QNo must be a valid number`);
          continue;
        }

        if (qNo !== expectedQNo) {
          errors.push(`Row ${rowNum}: QNo must be sequential (Expected: ${expectedQNo}, Actual: ${qNo})`);
        }
        expectedQNo++;

        if (qType !== "OP" && qType !== "WC" && qType !== "QZ") {
          errors.push(`Row ${rowNum}: Invalid Question Type (Must be exactly "OP", "WC", or "QZ")`);
          continue;
        }

        const type = (qType === "OP" || qType === "QZ") ? "multiple_choice" : "word_cloud";
        const options: string[] = [];

        if (type === "multiple_choice") {
          for (let j = 3; j <= 10; j++) {
            const opt = row[j]?.trim();
            if (opt && opt !== "") {
              options.push(opt);
            }
          }
          if (options.length < 2) {
            errors.push(`Row ${rowNum}: OP/QZ (Multiple Choice) requires at least 2 options (Option1 and Option2)`);
          }
        }

        let correctOptionVal: number | null = null;
        if (qType === "QZ") {
          const ansStr = row[11]?.trim(); // index 11 is the 12th column "Answer"
          if (!ansStr || ansStr === "") {
            errors.push(`Row ${rowNum}: QZ (Quiz Question) requires a valid "Answer" value (1 to 8) in the 12th column`);
          } else {
            const ansVal = parseInt(ansStr, 10);
            if (isNaN(ansVal) || ansVal < 1 || ansVal > 8) {
              errors.push(`Row ${rowNum}: "Answer" must be a valid integer between 1 and 8`);
            } else if (ansVal > options.length) {
              errors.push(`Row ${rowNum}: "Answer" (${ansVal}) exceeds the number of options entered (${options.length})`);
            } else {
              correctOptionVal = ansVal;
            }
          }
        }

        parsedQuestions.push({
          type,
          promptText,
          options,
          correct_option: correctOptionVal,
        });
      }

      if (errors.length > 0) {
        setCsvErrors(errors);
        if (event.target) event.target.value = "";
        return;
      }

      try {
        if (session) {
          await clientDb.bulkImportQuestions(session.id, parsedQuestions);
          setActionMessage(`Successfully imported ${parsedQuestions.length} questions!`);
          setCsvErrors([]);
          setShowCsvImporter(false);
          void loadHostData();
          setTimeout(() => setActionMessage(""), 2000);
        }
      } catch (err: any) {
        console.error("Bulk import failed:", err);
        setCsvErrors([err.message || "Bulk database insertion failed."]);
      }

      if (event.target) event.target.value = "";
    };

    reader.readAsText(file);
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
      const totalWords = list.length;
      
      // Scale spiral step and bounding box dynamically in full-screen mode
      const stepBase = totalWords > 10 ? Math.max(12, 30 - (totalWords - 10) * 1.2) : 30;
      const step = isFullScreen ? stepBase * 1.8 : stepBase;
      const radius = index * step + (isFullScreen ? 25 : 15);
      
      const maxH = isFullScreen ? 450 : 220;
      const maxV = isFullScreen ? 280 : 140;
      
      const x = Math.cos(angle) * Math.min(radius, maxH);
      const y = Math.sin(angle) * Math.min(radius, maxV);
      
      return {
        ...word,
        x,
        y,
      };
    });
  }, [activeQuestion, responses, isFullScreen]);

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
    <AppShell email="Presenter Console" identityLabel={`Active PulseRoom Pin: ${code}`} role={userRole}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        
        {/* Presenter Actions Banner - Sleek Dark overlay */}
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-violet-500/5 opacity-20 pointer-events-none" />

          <div className="flex flex-wrap items-center gap-4 relative z-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 shadow-md">
              <Radio className="size-5 animate-pulse" />
            </span>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                className="text-2xl font-black text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-cyan-400 focus:outline-none w-full max-w-xl transition-all duration-200"
                placeholder="Untitled PulseRoom"
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  Online: <span className="font-extrabold text-slate-200 flex items-center gap-1"><UsersRound className="size-3.5 text-cyan-400" /> {onlineCount} looked</span>
                </span>
                <span className="text-slate-700 hidden sm:inline">|</span>
                <span className="flex items-center gap-1">
                  Attempted: <span className="font-extrabold text-slate-200 flex items-center gap-1"><Radio className="size-3.5 text-emerald-400" /> {attemptedCount} unique</span>
                </span>
                <span className="text-slate-700 hidden sm:inline">|</span>
                <span>
                  Created: <span className="font-semibold text-slate-300">{new Date(session.created_at).toLocaleString()}</span> by <span className="font-bold text-cyan-400">{session.creator?.full_name || session.creator_name || "Unknown"} ({session.creator?.email || session.creator_email || "Unknown"})</span>
                </span>
                <span className="text-slate-700 hidden sm:inline">|</span>
                <span className="flex items-center gap-1">
                  Access Mode: <span className="font-extrabold text-cyan-400">
                    {session.auth_mode === "anonymous"
                      ? "Anonymous"
                      : session.auth_mode === "gmail"
                      ? "Gmail Verified"
                      : session.auth_mode === "quiz_gmail"
                      ? "Quiz (Gmail Verified)"
                      : session.auth_mode || "Anonymous"}
                  </span>
                </span>
                {session.updater && (
                  <>
                    <span className="text-slate-700 hidden sm:inline">|</span>
                    <span>
                      Modified: <span className="font-semibold text-slate-300">{new Date(session.updated_at).toLocaleString()}</span> by <span className="font-bold text-cyan-400">{session.updater?.full_name || session.updater_name || "Unknown"} ({session.updater?.email || session.updater_email || "Unknown"})</span>
                    </span>
                  </>
                )}
                {session.last_live_at && (
                  <>
                    <span className="text-slate-700 hidden sm:inline">|</span>
                    <span>
                      Last Live: <span className="font-semibold text-slate-300">{new Date(session.last_live_at).toLocaleString()}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2.5 relative z-10">
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

        {/* Dynamic Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 border rounded-2xl p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors duration-300 ${
            session.status === "active"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-slate-500/20 bg-slate-900/40 text-slate-300"
          }`}
        >
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
          <div className="flex items-start gap-3.5 z-10">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              session.status === "active"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-slate-800/40 border border-white/5 text-slate-400"
            }`}>
              {session.status === "active" ? (
                <Radio className="size-5 animate-pulse" />
              ) : (
                <Lock className="size-5" />
              )}
            </span>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {session.status === "active" ? "Room is active" : "The Room is Inactive"}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {session.status === "active"
                  ? "Voters can successfully join and submit real-time answers to live questions."
                  : "Voters cannot join or submit answers while the room is inactive. Activate it to open participation."}
              </p>
            </div>
          </div>
          <div className="z-10 shrink-0">
            <Button
              onClick={handleToggleSessionStatus}
              className={`h-11 px-6 font-black flex items-center gap-2 cursor-pointer shadow-lg transition-all duration-200 ${
                session.status === "active"
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                  : "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/10"
              }`}
            >
              <Radio className={`size-4 ${session.status === "active" ? "" : "animate-pulse"}`} />
              {session.status === "active" ? "Deactivate PulseRoom" : "Activate PulseRoom"}
            </Button>
          </div>
        </motion.div>

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

        {/* TOP: Questionnaire Manager & Creator (Full Width) */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative mb-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-lg font-black flex items-center gap-2 text-white">
              <Plus className="size-4 text-cyan-400" />
              Add Questions
            </h3>
            
            {/* Tabs Selector */}
            <div className="flex rounded-lg border border-white/5 bg-slate-950/45 p-1">
              <button
                type="button"
                onClick={() => setShowCsvImporter(false)}
                className={`h-7 px-3 rounded text-[11px] font-bold transition cursor-pointer ${
                  !showCsvImporter
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setShowCsvImporter(true)}
                className={`h-7 px-3 rounded text-[11px] font-bold transition cursor-pointer ${
                  showCsvImporter
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                CSV Import
              </button>
            </div>
          </div>

          {!showCsvImporter ? (
            <form onSubmit={handleAddQuestion} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-start w-full">
                
                {/* Question Type */}
                <div className="w-full md:w-56 shrink-0">
                  <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Question Type
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/5 bg-slate-950/45 p-1 h-11">
                    {(["multiple_choice", "word_cloud"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewType(type)}
                        className={`h-full rounded text-[11px] font-bold capitalize transition cursor-pointer ${
                          newType === type
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {type === "multiple_choice" ? "MC Poll" : "Word Cloud"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="flex-1 min-w-0 w-full">
                  <label htmlFor="prompt" className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Question Prompt
                  </label>
                  <Input
                    id="prompt"
                    required
                    placeholder="e.g. Rate your confidence"
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    className="text-sm h-11 bg-slate-950/40 border-white/5 text-white w-full"
                  />
                </div>

                {/* Save Button */}
                <div className="w-full md:w-auto shrink-0 self-end">
                  <Button
                    type="submit"
                    className="w-full md:w-auto h-11 px-6 text-xs font-extrabold cursor-pointer"
                    disabled={submittingQuestion}
                  >
                    Save to PulseRoom Stack
                  </Button>
                </div>

              </div>

              {/* Options Panel - renders below/alongside prompt when MC is selected */}
              {newType === "multiple_choice" && (
                <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4 space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Options (2 - 6 options)
                      </label>
                      
                      {/* Right Answer Selector for Quiz Mode */}
                      {session?.auth_mode === "quiz_gmail" && (
                        <div className="flex items-center gap-2">
                          <label htmlFor="correct-option-select" className="text-xs font-bold text-cyan-400 uppercase tracking-wider whitespace-nowrap">
                            Right Answer:
                          </label>
                          <select
                            id="correct-option-select"
                            value={correctOption || ""}
                            onChange={(e) => setCorrectOption(parseInt(e.target.value) || null)}
                            className="h-8 px-2 rounded bg-slate-950 border border-white/10 text-white text-xs font-semibold focus:border-cyan-400 focus:outline-none"
                            required
                          >
                            <option value="">-- Select Right Option --</option>
                            {mcOptions.map((_, idx) => (
                              <option key={idx} value={idx + 1}>
                                Option {idx + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] uppercase font-black text-cyan-400 hover:bg-cyan-400/10 cursor-pointer"
                      onClick={addOptionInput}
                      disabled={mcOptions.length >= 6}
                    >
                      + Add option
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                          className="h-9 text-xs bg-slate-950/40 border-white/5 text-white flex-1 min-w-0"
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
            </form>
          ) : (
            <div className="mt-4 space-y-4 pr-1">
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-center flex flex-col items-center justify-center">
                <Upload className="size-8 text-cyan-400 animate-pulse mb-3" />
                <h4 className="text-sm font-extrabold text-white">Import questions via CSV</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto">
                  Quickly upload multiple questions in bulk. Supported types: OP (Multiple Choice) & WC (Word Cloud).
                </p>
                
                <input
                  type="file"
                  ref={csvFileInputRef}
                  onChange={handleCSVUpload}
                  accept=".csv"
                  className="hidden"
                />
                
                <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full justify-center">
                  <Button
                    type="button"
                    onClick={() => csvFileInputRef.current?.click()}
                    className="h-10 text-xs font-extrabold bg-cyan-500 hover:bg-cyan-600 text-slate-950 cursor-pointer shadow-lg shadow-cyan-500/10"
                  >
                    Choose CSV File
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDownloadSampleCSV}
                    className="h-10 text-xs font-extrabold border border-white/5 bg-slate-950/60 hover:bg-slate-950 text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="size-3.5 text-cyan-400" />
                    Download Template
                  </Button>
                </div>
              </div>

              {/* All-or-nothing Visual Error Log Container */}
              {csvErrors.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-red-500/10 pb-2 mb-2">
                    <span className="text-xs font-black text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <X className="size-3.5" />
                      Import Errors ({csvErrors.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCsvErrors([])}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-[11px] font-mono text-red-300">
                    {csvErrors.map((err, i) => (
                      <div key={i} className="flex gap-1.5 items-start leading-relaxed">
                        <span className="text-red-500 font-extrabold shrink-0">&bull;</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* BOTTOM: Workspace Split-Screen (Span 5 Left, Span 7 Right) */}
        <div
          ref={workspaceRef}
          className={`w-full transition-all duration-300 ${
            isFullScreen ? "p-8 bg-[#0b0f19] overflow-y-auto h-full flex flex-col gap-4 z-50" : ""
          }`}
        >
          <div className="flex justify-end relative z-30 mb-2">
            <Button
              type="button"
              onClick={toggleFullScreen}
              className="h-9 px-3.5 bg-slate-800/80 hover:bg-slate-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer rounded-xl border border-white/10 shadow-lg shadow-black/25 backdrop-blur-md transition-all duration-200"
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="size-4 text-cyan-400" />
                  Exit Full Screen
                </>
              ) : (
                <>
                  <Maximize2 className="size-4 text-cyan-400" />
                  Full Screen
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
            
            {/* LEFT COLUMN: Question Stack (Span 5) */}
            <div className={`col-span-12 ${isFullScreen ? "lg:col-span-3" : "lg:col-span-5"} flex flex-col gap-6`}>
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative flex flex-col h-full">
              <h3 className="text-lg font-black border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                <BarChart3 className="size-4 text-cyan-400" />
                PulseRoom Stack ({questions.length})
              </h3>

              {/* Scrollable Container */}
              <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 relative flex-1">
                
                {/* Grouped Launch & Delete Sticky Action Buttons */}
                {questions.length > 0 && (
                  session?.status === "active" ? (
                    <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 pb-3 mb-3 pt-1">
                      <div className="flex flex-wrap gap-2">
                        {/* State 1: Idle Toolbar */}
                        {consoleMode === "idle" && (
                          <>
                            {isAutoLaunchConfigExpanded ? (
                              <div className="flex items-center gap-2 bg-slate-950/40 border border-white/5 rounded-lg px-3 py-1.5 w-full flex-wrap">
                                <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">Time per question (10-300s):</span>
                                <Input
                                  type="number"
                                  min={10}
                                  max={300}
                                  value={autoLaunchDuration}
                                  onChange={(e) => setAutoLaunchDuration(parseInt(e.target.value, 10) || 10)}
                                  className="w-20 h-8 text-center text-xs bg-slate-900 border-white/10 text-white font-bold"
                                />
                                <Button
                                  type="button"
                                  onClick={handleStartAutoLaunch}
                                  className="h-8 px-3 text-[10px] font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-slate-950 cursor-pointer rounded-md"
                                >
                                  Start
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => setIsAutoLaunchConfigExpanded(false)}
                                  className="h-8 px-3 text-[10px] font-black uppercase bg-slate-800 hover:bg-slate-700 text-white cursor-pointer rounded-md"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  onClick={handleStartManual}
                                  className="flex-1 min-w-[110px] h-10 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-sky-500/10 animate-all duration-200"
                                  title="Start Manual Sequence"
                                >
                                  <Play className="size-3.5 text-slate-950" />
                                  Start Manual
                                </Button>

                                <Button
                                  type="button"
                                  onClick={() => setIsAutoLaunchConfigExpanded(true)}
                                  className="flex-1 min-w-[110px] h-10 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10 animate-all duration-200"
                                  title="Auto-Launch Configuration"
                                >
                                  <Clock className="size-3.5 text-slate-950" />
                                  Auto-Launch
                                </Button>

                                <Button
                                  type="button"
                                  onClick={handleLaunchSelected}
                                  disabled={selectedQuestionIds.length === 0}
                                  className="flex-1 min-w-[110px] h-10 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10 animate-all duration-200"
                                  title="Launch Selected Questions"
                                >
                                  <Play className="size-3.5 text-slate-950" />
                                  Launch Selected ({selectedQuestionIds.length})
                                </Button>
                                
                                <Button
                                  type="button"
                                  onClick={handleLaunchAll}
                                  className="flex-1 min-w-[110px] h-10 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 animate-all duration-200"
                                  title="Launch All Questions"
                                >
                                  <Radio className="size-3.5 animate-pulse text-slate-950" />
                                  Launch All
                                </Button>

                                <Button
                                  type="button"
                                  onClick={handleBulkDelete}
                                  disabled={selectedQuestionIds.length === 0}
                                  className="flex-1 min-w-[110px] h-10 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-400 border border-red-500/20 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/10 animate-all duration-200"
                                  title="Delete Selected"
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete ({selectedQuestionIds.length})
                                </Button>
                              </>
                            )}
                          </>
                        )}

                        {/* State 2: Manual Sequence Toolbar */}
                        {consoleMode === "manual" && (
                          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2 w-full sm:w-auto flex-1 text-red-400 text-xs font-black uppercase tracking-wider">
                              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping mr-1" />
                              LIVE: Q{questions.findIndex(q => q.id === activeQuestion?.id) + 1}
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto shrink-0">
                              <Button
                                type="button"
                                onClick={handleManualLaunch}
                                className="flex-1 sm:flex-initial min-w-[120px] h-10 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-sky-500/10 animate-all duration-200"
                                title={manualLaunchPointer === questions.length ? "Finish Sequence" : "Launch Next Question"}
                              >
                                <Play className="size-3.5 text-slate-950" />
                                {manualLaunchPointer === questions.length ? "🏁 Finish" : "⏭ Launch Next"}
                              </Button>
                              
                              <Button
                                type="button"
                                onClick={handleEndAndCompleteManual}
                                className="flex-1 sm:flex-initial min-w-[120px] h-10 bg-red-500 hover:bg-red-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/10 animate-all duration-200"
                                title="End & Complete Live Question"
                              >
                                <X className="size-3.5 text-slate-950" />
                                End & Complete
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* State 3: Auto-Launch Countdown Toolbar */}
                        {consoleMode === "auto" && (
                          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3.5 py-2 w-full sm:w-auto flex-1 text-amber-400 text-xs font-black uppercase tracking-wider">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse mr-1" />
                              AUTO-LIVE: Q{questions.findIndex(q => q.id === activeQuestion?.id) + 1} (⏱️ {timerSecondsLeft !== null ? timerSecondsLeft : 0}s remaining)
                            </div>
                            
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
                              <Button
                                type="button"
                                onClick={handleTogglePauseAutoLaunch}
                                className={`flex-1 sm:flex-initial min-w-[100px] h-10 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg animate-all duration-200 ${
                                  isAutoLaunchPaused
                                    ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/10"
                                    : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10"
                                }`}
                                title={isAutoLaunchPaused ? "Resume Auto-Launch Timer" : "Pause Auto-Launch Timer"}
                              >
                                <Play className="size-3.5 text-slate-950" />
                                {isAutoLaunchPaused ? "Resume" : "Pause"}
                              </Button>
                              
                              <Button
                                type="button"
                                onClick={handleSkipAutoLaunch}
                                className="flex-1 sm:flex-initial min-w-[100px] h-10 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10 animate-all duration-200"
                                title="Skip to Next Question"
                              >
                                <Play className="size-3.5 text-slate-950" />
                                Skip to Next
                              </Button>
                              
                              <Button
                                type="button"
                                onClick={handleCancelAutoLaunch}
                                className="flex-1 sm:flex-initial min-w-[100px] h-10 bg-red-500 hover:bg-red-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/10 animate-all duration-200"
                                title="Cancel Auto-Launch Sequence"
                              >
                                <X className="size-3.5 text-slate-950" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* State 4: Bulk Launch Toolbar */}
                        {consoleMode === "bulk" && (
                          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                            <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3.5 py-2 w-full sm:w-auto flex-1 text-violet-400 text-xs font-black uppercase tracking-wider">
                              <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse mr-1" />
                              LIVE: {liveQuestionsList.length} Questions
                            </div>
                            
                            <Button
                              type="button"
                              onClick={handleMarkAllBulkCompleted}
                              className="w-full sm:w-auto min-w-[150px] h-10 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 animate-all duration-200 shrink-0"
                              title="Mark All Live Questions Completed"
                            >
                              <CheckCircle2 className="size-3.5 text-slate-950" />
                              Mark All Completed
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 pb-3 mb-3 pt-1">
                      <div className="flex items-center justify-center bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 w-full text-amber-400 font-extrabold text-xs uppercase tracking-wider text-center">
                        ⚠️ Activate the PulseRoom to enable launch controls.
                      </div>
                    </div>
                  )
                )}
                
                <div className="space-y-2.5">
                  {questions.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">
                      PulseRoom stack is empty. Create some questions above!
                    </p>
                  ) : (
                    paginatedQuestions.map((q, idx) => {
                      const globalIndex = (currentPage - 1) * questionsPerPage + idx;
                      const isExpanded = expandedQuestionIds.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => {
                            setActiveQuestion(q);
                            setManualLaunchPointer(globalIndex);
                            void reloadResponses(q.id);
                          }}
                          className={`p-3 rounded-xl border flex flex-col gap-2 transition-all duration-200 cursor-pointer hover:bg-slate-800 ${
                            activeQuestion?.id === q.id 
                              ? "border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-400/5" 
                              : q.is_live
                              ? "border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10"
                              : "border-white/5 bg-slate-950/20 hover:bg-slate-950/40"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex gap-3 items-start flex-1 min-w-0">
                              {consoleMode === "idle" && (
                                <input
                                  type="checkbox"
                                  id={`select-${q.id}`}
                                  name={`select-${q.id}`}
                                  aria-label={`Select Question ${globalIndex + 1}`}
                                  className="mt-1 size-4 shrink-0 rounded border-white/10 bg-slate-950 accent-cyan-500 cursor-pointer"
                                  checked={selectedQuestionIds.includes(q.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleSelectQuestion(q.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-block rounded-[4px] text-[9px] font-extrabold px-2 py-0.5 uppercase tracking-wider ${
                                    q.is_live ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
                                  }`}>
                                    Q{globalIndex + 1} &middot; {q.type === "multiple_choice" ? "MC" : "Word"}
                                  </span>
                                  {q.is_live ? (
                                    <span className="inline-block rounded-[4px] text-[9px] font-black px-2 py-0.5 uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                                      LIVE
                                    </span>
                                  ) : q.is_completed ? (
                                    <span className="inline-block rounded-[4px] text-[9px] font-extrabold px-2 py-0.5 uppercase tracking-wider bg-slate-700/60 text-slate-400 border border-white/5 flex items-center gap-1">
                                      <CheckCircle2 className="size-2.5 text-slate-500" />
                                      Done
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
                                <h4 className="font-extrabold text-sm mt-1 text-slate-200 whitespace-normal break-words text-wrap" title={q.prompt_text}>
                                  {q.prompt_text}
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {q.type === "multiple_choice" && q.options?.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleExpandQuestion(q.id, e)}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                                  title={isExpanded ? "Collapse Options" : "Expand Options"}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="size-3.5" />
                                  ) : (
                                    <ChevronDown className="size-3.5" />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleMoveQuestion(globalIndex, "up")}
                                disabled={globalIndex === 0}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 cursor-pointer transition-colors"
                                title="Move Up"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveQuestion(globalIndex, "down")}
                                disabled={globalIndex === questions.length - 1}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 cursor-pointer transition-colors"
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
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer shrink-0 transition-colors"
                                title="Delete Question"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Collapsible Options Tray */}
                          {q.type === "multiple_choice" && q.options?.length > 0 && isExpanded && (
                            <div 
                              className="mt-1 pl-7 pr-2 py-2 rounded-lg bg-slate-950/40 border border-white/5 space-y-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Options preview:</p>
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="text-xs text-slate-300 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                                  <span className="whitespace-normal break-words text-wrap">{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer transition-all duration-200"
                  >
                    Prev
                  </Button>
                  <span className="text-xs font-bold text-slate-400 select-none">
                    Page <span className="text-cyan-400 font-extrabold">{currentPage}</span> of <span className="text-slate-300 font-extrabold">{totalPages}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-9 px-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 cursor-pointer transition-all duration-200"
                  >
                    Next
                  </Button>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN: Live Results & Visualizations (Span 7) */}
          <div className={`col-span-12 ${isFullScreen ? "lg:col-span-9" : "lg:col-span-7"} flex flex-col gap-6`}>
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl relative overflow-hidden flex flex-col h-full justify-between">
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

              <div className="relative z-10 flex-1 flex flex-col justify-center min-h-[384px]">
                {!activeQuestion ? (
                  <div className="h-96 flex flex-col items-center justify-center text-center">
                    <HelpCircle className="size-16 text-slate-700 animate-pulse mb-4" />
                    <h3 className="text-xl font-black text-slate-300">Screen is blank</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm">
                      Select a question from your PulseRoom stack on the left and click "Launch" to start streaming results!
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
                          width={160}
                          tick={(props) => <CustomYAxisTick {...props} activeQuestion={activeQuestion} />}
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
                          {chartData.map((entry, index) => {
                            const isQuiz = activeQuestion?.correct_option !== null && activeQuestion?.correct_option !== undefined;
                            const isCorrect = isQuiz && activeQuestion?.correct_option === index + 1;
                            const barColor = isQuiz ? (isCorrect ? "#22c55e" : "#fca5a5") : "#06b6d4";
                            return <Cell key={`cell-${index}`} fill={barColor} />;
                          })}
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
                  <div className={`w-full border border-white/5 rounded-xl bg-slate-950/40 relative shadow-inner flex items-center justify-center transition-all duration-300 ${
                    isFullScreen ? "h-[72vh] overflow-visible" : "h-96 overflow-hidden"
                  }`}>
                    {wordCloudWords.map((word, index) => {
                      // Scale down font sizes if the word itself is very long to prevent cutoff
                      const textLengthFactor = word.text.length > 8 ? Math.max(0.45, 8 / word.text.length) : 1;
                      // Scale down font sizes when total word count is large to prevent crowding
                      const totalWords = wordCloudWords.length;
                      const countScale = totalWords > 15 ? Math.max(0.5, 15 / totalWords) : 1;
                      
                      // Scale base font ranges dynamically for full screen mode
                      const fsMin = isFullScreen ? 28 : 16;
                      const fsMaxOffset = isFullScreen ? 96 : 48;
                      const countMultiplier = isFullScreen ? 15 : 8;
                      const baseFontSize = fsMin + Math.min(word.count * countMultiplier, fsMaxOffset);
                      const fontSize = baseFontSize * scale * textLengthFactor * countScale;
                      
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

          </div>
        </div>

        {session?.auth_mode === "quiz_gmail" && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-violet-500/5 opacity-20 pointer-events-none" />
            
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4 relative z-10">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Trophy className="size-5 text-amber-400" />
                  Live PulseRoom Leaderboard
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time participant rankings and score standings.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void reloadLeaderboard(session.id)}
                className="h-9 px-4 border border-white/5 bg-slate-950/40 hover:bg-slate-950 text-white font-bold flex items-center gap-2"
              >
                <RefreshCw className="size-3.5 text-cyan-400" />
                Refresh Scores
              </Button>
            </div>

            <div className="relative z-10 overflow-x-auto">
              {leaderboard.length === 0 ? (
                <div className="py-12 text-center">
                  <UsersRound className="size-12 text-slate-700 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm text-slate-500 font-medium">No participants registered yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Standings will appear once players sign in and join the lobby.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Player Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {leaderboard.map((player, idx) => {
                        const rank = idx + 1;
                        let rankStyle = "text-slate-400 font-bold";
                        let rowBg = "hover:bg-white/[0.02]";
                        let rankBadge = null;

                        if (rank === 1) {
                          rankStyle = "text-amber-400 font-extrabold";
                          rowBg = "bg-amber-400/5 hover:bg-amber-400/10 border-l-4 border-l-amber-400";
                          rankBadge = <Trophy className="size-4 text-amber-400 shrink-0" />;
                        } else if (rank === 2) {
                          rankStyle = "text-slate-300 font-extrabold";
                          rowBg = "bg-slate-300/5 hover:bg-slate-300/10 border-l-4 border-l-slate-300";
                          rankBadge = <Medal className="size-4 text-slate-300 shrink-0" />;
                        } else if (rank === 3) {
                          rankStyle = "text-amber-600 font-extrabold";
                          rowBg = "bg-amber-600/5 hover:bg-amber-600/10 border-l-4 border-l-amber-600";
                          rankBadge = <Medal className="size-4 text-amber-600 shrink-0" />;
                        }

                        return (
                          <motion.tr
                            key={player.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, delay: idx * 0.05 }}
                            className={`border-b border-white/5 transition-colors ${rowBg}`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                {rankBadge}
                                <span className={rankStyle}>#{rank}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-200">
                              {player.name}
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 font-medium text-xs font-mono">
                              {player.email}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-white text-sm">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold tracking-wide ${
                                rank === 1
                                  ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                                  : rank === 2
                                  ? "bg-slate-300/10 text-slate-300 border border-slate-300/20"
                                  : rank === 3
                                  ? "bg-amber-600/10 text-amber-600 border border-amber-600/20"
                                  : "bg-slate-950 text-slate-400 border border-white/5"
                              }`}>
                                {player.score} pts
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Auto-Launch Modal Dialog */}
      <AnimatePresence>
        {showAutoLaunchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setShowAutoLaunchModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-violet-500/5 opacity-30 pointer-events-none" />

              <h2 className="text-xl font-black text-white relative z-10">
                Trigger Auto Launch Timer
              </h2>
              <p className="mt-1 text-xs text-slate-400 relative z-10">
                Specify a timer duration to auto-advance through all questions.
              </p>

              <form onSubmit={handleAutoLaunchSubmit} className="mt-5 space-y-4 relative z-10">
                <div>
                  <label htmlFor="modal-timer-seconds" className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Timer Duration (10 - 300 seconds)
                  </label>
                  <Input
                    type="number"
                    id="modal-timer-seconds"
                    name="modal-timer-seconds"
                    required
                    min={10}
                    max={300}
                    placeholder="e.g. 30"
                    value={autoLaunchDuration}
                    onChange={(e) => setAutoLaunchDuration(parseInt(e.target.value, 10) || 0)}
                    className="h-11 bg-slate-950/50 border-white/10 text-white placeholder-slate-500 focus:border-cyan-400 text-sm font-medium"
                  />
                  {autoLaunchError && (
                    <p className="mt-2 text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                      {autoLaunchError}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAutoLaunchModal(false)}
                    className="h-10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={autoLaunchDuration < 10 || autoLaunchDuration > 300}
                    className="h-10 px-5 text-xs font-black uppercase tracking-wider bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-lg shadow-cyan-500/10 cursor-pointer"
                  >
                    Start Auto-Launch
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
