"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Clock3,
  FilePlus2,
  Play,
  Search,
  Trash2,
  Layers,
  Radio,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Session } from "@/lib/schema";
import * as clientDb from "@/lib/clientDb";
import { broadcastSessionEvent } from "@/lib/realtime";

export function DashboardWorkspace({
  email,
  initialSessions,
  displayName,
  userId,
}: {
  email: string;
  initialSessions: Session[];
  displayName?: string;
  userId: string;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");

  const visibleSessions = useMemo(() => {
    return sessions.filter((session) =>
      session.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [sessions, query]);

  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === "active").length;
  const inactiveSessions = sessions.filter((s) => s.status === "inactive").length;

  async function handleCreateSessionDirect() {
    const trimmedName = newSessionName.trim();
    if (!trimmedName || trimmedName.toLowerCase() === "untitled session" || loading) return;
    setLoading(true);
    try {
      const created = await clientDb.createSession(userId, trimmedName);
      setNewSessionName("");
      setShowCreateModal(false);
      router.push(`/session/${created.code}/host`);
    } catch (err) {
      console.error("Error creating session:", err);
      setLoading(false);
    }
  }

  async function handleToggleStatus(session: Session) {
    const nextStatus = session.status === "active" ? "inactive" : "active";
    setSessions((current) =>
      current.map((s) =>
        s.id === session.id ? { ...s, status: nextStatus } : s
      )
    );

    try {
      await clientDb.updateSessionStatus(session.id, nextStatus);
      void broadcastSessionEvent(session.code, {
        type: "session_status",
        payload: { status: nextStatus },
      });
    } catch (err) {
      console.error("Error updating session:", err);
      setSessions((current) =>
        current.map((s) =>
          s.id === session.id ? { ...s, status: session.status } : s
        )
      );
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("Are you sure you want to delete this session? This will remove all questions and responses.")) return;

    setSessions((current) => current.filter((s) => s.id !== sessionId));

    try {
      await clientDb.deleteSession(sessionId);
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Header Section */}
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">
            Control Panel
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Live Rooms
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Create and manage interactive real-time polling sessions here.
          </p>
        </div>
        
        <Button 
          onClick={() => {
            setNewSessionName("");
            setShowCreateModal(true);
          }} 
          disabled={loading}
          className="w-full sm:w-fit h-12 px-6 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold flex items-center justify-center gap-2 group shadow-lg shadow-cyan-500/10 cursor-pointer"
        >
          <FilePlus2 className="size-4 transition-transform group-hover:scale-110" />
          Create Session
        </Button>
      </div>

      {/* Stats Board */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Sessions", val: totalSessions, icon: Layers },
          { label: "Active Live Rooms", val: activeSessions, icon: Radio, highlight: true },
          { label: "Inactive Rooms", val: inactiveSessions, icon: CalendarClock }
        ].map(({ label, val, icon: Icon, highlight }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={`rounded-2xl border p-5 shadow-2xl backdrop-blur-2xl relative ${
              highlight
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                : "border-white/10 bg-slate-900/40 text-white"
            }`}
          >
            <Icon className={`size-5 ${highlight ? "text-emerald-400" : "text-cyan-400"}`} />
            <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-3xl font-black">{val}</p>
          </motion.div>
        ))}
      </section>

      {/* Search Bar */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-2xl relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            id="search-query"
            name="search-query"
            aria-label="Search sessions by name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions by name"
            className="pl-9 h-11 bg-slate-950/40 border-white/5 text-white focus:border-cyan-400"
          />
        </div>
      </section>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-cyan-400/20 bg-slate-900/40 p-12 text-center shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-400 shadow-md animate-pulse">
            <Radio className="size-6" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">No polling sessions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-400 text-sm">
            Create your first PulseBoard live session to start asking questions and receiving responses in real-time.
          </p>
          <p className="mx-auto mt-4 max-w-md text-cyan-400 font-extrabold text-xs uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 py-2 px-4 rounded-full w-fit">
            Create your first session by clicking 'Create session' at the top of the page.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visibleSessions.map((session, index) => (
              <motion.article
                key={session.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-2xl transition hover:border-cyan-400/30"
              >
                {/* Visual Header */}
                <div className={`h-24 p-4 flex justify-between items-start transition ${
                  session.status === "active"
                    ? "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-b border-emerald-500/20"
                    : "bg-slate-950/50 border-b border-white/5"
                }`}>
                  <span className="rounded-md bg-slate-950/40 border border-white/5 px-2.5 py-1 text-xs font-bold text-white tracking-wider">
                    CODE: <span className="font-black text-cyan-400 text-sm tracking-widest">{session.code}</span>
                  </span>
                  
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                    session.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse"
                      : "bg-slate-800/40 text-slate-400 border-white/5"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      session.status === "active" ? "bg-emerald-400" : "bg-slate-500"
                    }`} />
                    {session.status === "active" ? "Live" : "Inactive"}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold line-clamp-1 text-white group-hover:text-cyan-400 transition-colors">
                    {session.title}
                  </h3>
                  
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <p>
                      Created {new Date(session.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                    {session.creator_name && (
                      <div className="relative group/tooltip flex items-center gap-1.5 bg-slate-950/45 border border-white/5 py-0.5 px-2.5 rounded-[4px] text-[10px] font-extrabold text-slate-400">
                        <span>Created by:</span>
                        <span className="text-cyan-400 cursor-pointer select-none">
                          {session.creator_name.split(' ')[0]}
                        </span>
                        
                        {/* Interactive hover tooltip using custom tailwind classes */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover/tooltip:scale-100 bg-slate-950 text-white border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-3xl backdrop-blur-xl transition-all duration-150 origin-bottom z-50 pointer-events-none">
                          {session.creator_name} ({session.creator_email})
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions - strictly 44px+ height targets */}
                  <div className="mt-6 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button asChild size="sm" className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold cursor-pointer">
                        <Link href={`/session/${session.code}/host`}>
                          <Play className="size-4" />
                          Launch Console
                        </Link>
                      </Button>
                      
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-11 px-4 border border-white/5 bg-slate-950/40 text-slate-300 hover:text-white cursor-pointer"
                        onClick={() => handleToggleStatus(session)}
                        title={session.status === "active" ? "Deactivate Session" : "Activate Session"}
                      >
                        <Radio className={`size-4 ${session.status === "active" ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
                        {session.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                    </div>

                    <div className="flex gap-2 items-center justify-between mt-3 pt-3 border-t border-white/5">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-cyan-400 text-xs px-2.5 h-8 hover:bg-white/5 cursor-pointer"
                      >
                        <Link href={`/session/${session.code}`} target="_blank">
                          <ExternalLink className="size-3 text-cyan-400" />
                          Join Link
                        </Link>
                      </Button>

                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        className="h-8 w-8 p-0 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 cursor-pointer"
                        onClick={() => handleDeleteSession(session.id)}
                        title="Delete Session"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
      {/* Create Session Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
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
                Name your Live Room
              </h2>
              <p className="mt-1 text-xs text-slate-400 relative z-10">
                Every polling room needs a unique, custom descriptive title.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreateSessionDirect();
                }}
                className="mt-5 space-y-4 relative z-10"
              >
                <div>
                  <label htmlFor="session-name-input" className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Room Name
                  </label>
                  <Input
                    id="session-name-input"
                    name="session-name-input"
                    required
                    autoFocus
                    placeholder="e.g. Q3 Roadmap Brainstorm"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="h-11 bg-slate-950/50 border-white/10 text-white placeholder-slate-500 focus:border-cyan-400 text-sm font-medium"
                  />
                  {newSessionName.trim().toLowerCase() === "untitled session" && (
                    <p className="mt-1.5 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                      "Untitled Session" is not a valid room name
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCreateModal(false)}
                    className="h-10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      !newSessionName.trim() ||
                      newSessionName.trim().toLowerCase() === "untitled session"
                    }
                    className="h-10 px-5 text-xs font-black uppercase tracking-wider bg-cyan-500 hover:bg-cyan-600 disabled:opacity-30 disabled:pointer-events-none text-slate-950 shadow-lg shadow-cyan-500/10 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Creating...
                      </>
                    ) : (
                      "Create Room"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
