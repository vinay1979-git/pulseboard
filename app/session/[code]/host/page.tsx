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
  
  // CSV Bulk Importer & Pagination states
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [showCsvImporter, setShowCsvImporter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const questionsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(questions.length / questionsPerPage));
  
  const paginatedQuestions = useMemo(() => {
    const startIdx = (currentPage - 1) * questionsPerPage;
    return questions.slice(startIdx, startIdx + questionsPerPage);
  }, [questions, currentPage]);

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

  const handleLaunchAll = async () => {
    if (!session || questions.length === 0) return;
    try {
      const allQuestionIds = questions.map((q) => q.id);
      await clientDb.setQuestionsLive(session.id, allQuestionIds);
      
      setQuestions((current) =>
        current.map((q) => ({ ...q, is_live: true }))
      );

      // Focus on the first question
      const target = questions[0] || null;
      setActiveQuestion(target);
      setResponses([]);
      setParticipantsCount(0);

      // Reset selection checkbox array
      setSelectedQuestionIds([]);

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
    const headers = "QNo, Question, Question Type, Option1, Option2, Option3, Option4, Option5, Option6, Option7, Option8\n";
    const sample1 = "1, Which UI frame do you prefer?, OP, Clean Cards, Glassmorphism Grid, Minimalist Row,,,,,,\n";
    const sample2 = "2, Describe PulseBoard in one word, WC,,,,,,,,,,\n";
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

        if (qType !== "OP" && qType !== "WC") {
          errors.push(`Row ${rowNum}: Invalid Question Type (Must be exactly "OP" or "WC")`);
          continue;
        }

        const type = qType === "OP" ? "multiple_choice" : "word_cloud";
        const options: string[] = [];

        if (type === "multiple_choice") {
          for (let j = 3; j <= 10; j++) {
            const opt = row[j]?.trim();
            if (opt && opt !== "") {
              options.push(opt);
            }
          }
          if (options.length < 2) {
            errors.push(`Row ${rowNum}: OP (Multiple Choice) requires at least 2 options (Option1 and Option2)`);
          }
        }

        parsedQuestions.push({
          type,
          promptText,
          options,
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
                  Participants: <span className="font-extrabold text-slate-200 flex items-center gap-1"><UsersRound className="size-3.5 text-cyan-400" /> {participantsCount} online</span>
                </span>
                <span className="text-slate-700 hidden sm:inline">|</span>
                <span>
                  Created: <span className="font-semibold text-slate-300">{new Date(session.created_at).toLocaleString()}</span> by <span className="font-bold text-cyan-400">{session.creator?.full_name || session.creator_name || "Unknown"} ({session.creator?.email || session.creator_email || "Unknown"})</span>
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
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Options (2 - 6 options)
                    </label>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Question Stack (Span 5) */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-2xl relative flex flex-col h-full">
              <h3 className="text-lg font-black border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                <BarChart3 className="size-4 text-cyan-400" />
                PulseRoom Stack ({questions.length})
              </h3>

              {/* Scrollable Container */}
              <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 relative flex-1">
                
                {/* Grouped Launch & Delete Sticky Action Buttons */}
                {questions.length > 0 && (
                  <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 pb-3 mb-3 pt-1">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleLaunchSelected}
                        disabled={selectedQuestionIds.length === 0}
                        className="flex-1 min-w-[110px] h-10 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-slate-950 font-black text-[10px] uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10 animate-all duration-200"
                        title="Launch Selected"
                      >
                        <Play className="size-3.5 text-slate-950" />
                        Launch ({selectedQuestionIds.length})
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
                    </div>
                  </div>
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
                                <h4 className="font-extrabold text-sm mt-1 text-slate-200 truncate whitespace-nowrap" title={q.prompt_text}>
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
                                  <span className="truncate">{opt}</span>
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
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
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
