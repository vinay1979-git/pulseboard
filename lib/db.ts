import { isSupabaseConfigured } from "@/lib/env";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient, createAdminClient } from "@/lib/supabase/server";
import type { Session, Question, Response, UserProfile, SessionStatus, QuestionType, PulseParticipant } from "./schema";
import { pusherServer } from "./pusherServer";

function logDbError(context: string, error: any) {
  if (!error) {
    console.error(`[DB ERROR] ${context}: Unknown Error`);
    return;
  }
  const errMsg = error.message || error.details || (error instanceof Error ? error.toString() : (typeof error === "object" ? JSON.stringify(error) : String(error)));
  const errCode = error.code ? ` [Code: ${error.code}]` : "";
  const errHint = error.hint ? ` (Hint: ${error.hint})` : "";
  console.error(`[DB ERROR] ${context}: ${errMsg}${errCode}${errHint}`);
}

// In-Memory Database for local mock fallback
// Using global object to persist across hot reloads in Next.js development
interface LocalDatabase {
  sessions: Session[];
  questions: Question[];
  responses: Response[];
  profiles: UserProfile[];
  pulse_participants: PulseParticipant[];
}

const globalForDb = global as unknown as {
  _pulseboardDb?: LocalDatabase;
};

// Initialize the database with beautiful seed data if it doesn't exist
if (!globalForDb._pulseboardDb) {
  const demoSessionId = "demo-session-uuid";
  globalForDb._pulseboardDb = {
    sessions: [
      {
        id: demoSessionId,
        code: "123456",
        title: "Team Sync Feedback",
        status: "active",
        created_by: "demo-user-id",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "inactive-demo-uuid",
        code: "987654",
        title: "Product Launch Retro",
        status: "inactive",
        created_by: "demo-user-id",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      }
    ],
    questions: [
      {
        id: "q-demo-1",
        session_id: demoSessionId,
        type: "multiple_choice",
        prompt_text: "Which feature should we prioritize for the Q3 release?",
        options: ["Real-time Dashboards", "Advanced Analytics", "Mobile Companion App", "Offline Synchronization"],
        is_live: true,
        created_at: new Date().toISOString(),
        order_index: 0,
      },
      {
        id: "q-demo-2",
        session_id: demoSessionId,
        type: "word_cloud",
        prompt_text: "Describe the current release sprint in one word!",
        options: [],
        is_live: false,
        created_at: new Date(Date.now() + 1000).toISOString(),
        order_index: 1,
      }
    ],
    responses: [
      {
        id: "r-1",
        question_id: "q-demo-1",
        participant_id: "p-mock-1",
        value: "0",
        created_at: new Date().toISOString(),
      },
      {
        id: "r-2",
        question_id: "q-demo-1",
        participant_id: "p-mock-2",
        value: "0",
        created_at: new Date().toISOString(),
      },
      {
        id: "r-3",
        question_id: "q-demo-1",
        participant_id: "p-mock-3",
        value: "2",
        created_at: new Date().toISOString(),
      },
      {
        id: "r-w1",
        question_id: "q-demo-2",
        participant_id: "p-mock-1",
        value: "Exciting",
        created_at: new Date().toISOString(),
      },
      {
        id: "r-w2",
        question_id: "q-demo-2",
        participant_id: "p-mock-2",
        value: "Challenging",
        created_at: new Date().toISOString(),
      },
      {
        id: "r-w3",
        question_id: "q-demo-2",
        participant_id: "p-mock-3",
        value: "Exciting",
        created_at: new Date().toISOString(),
      }
    ],
    profiles: [
      {
        id: "demo-user-id",
        email: "vinay1979@gmail.com",
        role: "super-admin",
        approval_status: "approved",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "mock-voter-pending",
        email: "pending-power-user@test.com",
        role: "power-user",
        approval_status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ],
    pulse_participants: []
  };
}

const db = globalForDb._pulseboardDb;

function sanitizeText(text: string): string {
  if (!text) return "";
  // Strip HTML tags and scripts to prevent XSS injections
  return text.replace(/<[^>]*>/g, "").trim();
}

function isMockId(id: string): boolean {
  if (!id) return true;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return !uuidRegex.test(id) || id.startsWith("demo-") || id.startsWith("inactive-") || id.startsWith("q-demo-") || id.startsWith("r-") || id.startsWith("p-mock-") || id.startsWith("p-regression-");
}

async function getSessionCodeById(sessionId: string): Promise<string | null> {
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("sessions")
        .select("code")
        .eq("id", sessionId)
        .maybeSingle();
      if (data) return data.code;
    } catch (e) {
      console.error("Error getting session code by ID:", e);
    }
  }
  const session = db.sessions.find(s => s.id === sessionId);
  return session ? session.code : null;
}

async function getSessionCodeByQuestionId(questionId: string): Promise<string | null> {
  if (isSupabaseConfigured() && !isMockId(questionId)) {
    try {
      const supabase = await createServerClient();
      const { data: question } = await supabase
        .from("questions")
        .select("session_id")
        .eq("id", questionId)
        .maybeSingle();
      if (question) {
        return await getSessionCodeById(question.session_id);
      }
    } catch (e) {
      console.error("Error getting session code by question ID:", e);
    }
  }
  const question = db.questions.find(q => q.id === questionId);
  if (question) {
    return await getSessionCodeById(question.session_id);
  }
  return null;
}

// Database Adapter Methods

export async function getSessions(userId: string, isSuperAdmin = false): Promise<Session[]> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (isSupabaseConfigured() && (isSuperAdmin || uuidRegex.test(userId))) {
    try {
      const supabase = await createServerClient();
      let query = supabase.from("sessions").select("*");
      
      if (!isSuperAdmin) {
        query = query.eq("created_by", userId);
      }
      
      const { data, error } = await query.order("updated_at", { ascending: false });
      
      if (!error && data) {
        // Fetch all profiles to map creator info dynamically in a safe join bypass
        const { data: profiles } = await supabase.from("profiles").select("*");
        const profileMap = new Map((profiles as UserProfile[])?.map((p: UserProfile) => [p.id, p]) || []);
        
        return (data as Session[]).map(s => {
          const creator = profileMap.get(s.created_by);
          let creatorName = creator?.email.split('@')[0] || "Unknown";
          if (creator?.email === "vinay1979@gmail.com") creatorName = "Vinay Visvanathan";
          return {
            ...s,
            creator_email: creator?.email || "unknown@test.com",
            creator_name: creatorName
          };
        });
      }
    } catch (e) {
      console.error("Supabase getSessions error, falling back to mock:", e);
    }
  }
  
  // Local Mock Fallback
  const sessionsList = isSuperAdmin
    ? db.sessions
    : db.sessions.filter(s => s.created_by === userId || s.created_by === "demo-user-id");
    
  return sessionsList.map(s => {
    const creator = db.profiles.find(p => p.id === s.created_by);
    let creatorName = creator?.email.split('@')[0] || "Unknown";
    if (creator?.email === "vinay1979@gmail.com") creatorName = "Vinay Visvanathan";
    return {
      ...s,
      creator_email: creator?.email || "vinay1979@gmail.com",
      creator_name: creatorName
    };
  });
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  if (isSupabaseConfigured() && code !== "123456" && code !== "987654") {
    try {
      const isServer = typeof window === "undefined";
      const supabase = isServer ? await createServerClient() : createBrowserClient();
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      
      if (sessionError) {
        console.error("Supabase getSessionByCode error:", sessionError.message);
      }
      
      if (!sessionError && session) {
        const userIds = [session.created_by];
        if (session.updated_by) {
          userIds.push(session.updated_by);
        }
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUserIds = userIds.filter(id => uuidRegex.test(id));
        
        let profiles: any[] = [];
        if (validUserIds.length > 0) {
          const { data, error: profilesError } = await supabase
            .from("profiles")
            .select("*")
            .in("id", validUserIds);
            
          if (profilesError) {
            console.error("Supabase getSessionByCode profiles fetch error:", profilesError.message);
          } else if (data) {
            profiles = data;
          }
        }
        
        const profileMap = new Map((profiles as UserProfile[])?.map((p: UserProfile) => [p.id, p]) || []);
        const creator = profileMap.get(session.created_by);
        const updater = session.updated_by ? profileMap.get(session.updated_by) : null;
        
        let creatorName = creator?.email ? creator.email.split('@')[0] : "Unknown";
        if (creator?.email === "vinay1979@gmail.com") creatorName = "Vinay Visvanathan";
        
        let updaterName = undefined;
        let updaterEmail = undefined;
        if (session.updated_by && updater?.email) {
          updaterName = updater.email.split('@')[0];
          if (updater.email === "vinay1979@gmail.com") updaterName = "Vinay Visvanathan";
          updaterEmail = updater.email;
        }
        
        return {
          ...session,
          creator_name: creatorName,
          creator_email: creator?.email || "unknown@test.com",
          updater_name: updaterName,
          updater_email: updaterEmail,
          creator: {
            full_name: creatorName,
            email: creator?.email || "unknown@test.com"
          },
          updater: session.updated_by ? {
            full_name: updaterName || "Unknown",
            email: updater?.email || "unknown@test.com"
          } : null
        } as Session;
      }
    } catch (e) {
      console.error("Supabase getSessionByCode error, falling back to mock:", e);
    }
  }
  
  // Local Mock Fallback
  const session = db.sessions.find(s => s.code === code);
  if (session) {
    const creator = db.profiles.find(p => p.id === session.created_by);
    const updater = session.updated_by ? db.profiles.find(p => p.id === session.updated_by) : null;
    
    let creatorName = creator?.email.split('@')[0] || "Unknown";
    if (creator?.email === "vinay1979@gmail.com") creatorName = "Vinay Visvanathan";
    
    let updaterName = undefined;
    let updaterEmail = undefined;
    if (session.updated_by && updater?.email) {
      updaterName = updater.email.split('@')[0];
      if (updater.email === "vinay1979@gmail.com") updaterName = "Vinay Visvanathan";
      updaterEmail = updater.email;
    }
    
    return {
      ...session,
      creator_name: creatorName,
      creator_email: creator?.email || "vinay1979@gmail.com",
      updater_name: updaterName,
      updater_email: updaterEmail,
      creator: {
        full_name: creatorName,
        email: creator?.email || "vinay1979@gmail.com"
      },
      updater: session.updated_by ? {
        full_name: updaterName || "Unknown",
        email: updater?.email || "vinay1979@gmail.com"
      } : null
    } as Session;
  }
  return null;
}

export async function touchSession(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const activeUserId = user?.id || "demo-user-id";

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          updated_by: activeUserId,
          updated_at: now
        })
        .eq("id", sessionId);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase touchSession error:", e);
    }
  } else {
    // Local Mock Fallback
    const session = db.sessions.find(s => s.id === sessionId);
    if (session) {
      session.updated_by = activeUserId;
      session.updated_at = now;
    }
  }
}

import { AuthMode } from "./schema";

export async function createSession(
  userId: string,
  title: string,
  authMode: AuthMode = "anonymous",
  autoLaunch: boolean = false,
  timerSeconds: number = 0
): Promise<Session> {
  const sanitizedTitle = sanitizeText(title).trim();
  if (!sanitizedTitle || sanitizedTitle.toLowerCase() === "untitled session") {
    throw new Error("Invalid session title. Title cannot be empty or 'Untitled Session'.");
  }

  // Generate random unique 6-digit code
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isSupabase = isSupabaseConfigured() && uuidRegex.test(userId);

  const newSession: Session = {
    id: isSupabase ? crypto.randomUUID() : `demo-${crypto.randomUUID()}`,
    code,
    title: sanitizedTitle,
    status: "inactive",
    created_by: userId,
    updated_by: userId,
    last_live_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    auth_mode: authMode,
    auto_launch: autoLaunch,
    timer_seconds: timerSeconds,
  };

  if (isSupabase) {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("sessions")
        .insert(newSession)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      if (data) return data as Session;
    } catch (e: any) {
      console.error("Supabase createSession error:", e);
      throw new Error(e.message || "Failed to create session");
    }
  }

  // Local Mock Fallback
  db.sessions.unshift(newSession);
  return newSession;
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus, userId?: string): Promise<void> {
  const now = new Date().toISOString();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const activeUserId = userId || user?.id || "demo-user-id";

  const updates: any = { 
    status, 
    updated_at: now,
    updated_by: activeUserId
  };
  
  if (status === "active") {
    updates.last_live_at = now;
  }

  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const { error } = await supabase
        .from("sessions")
        .update(updates)
        .eq("id", sessionId);
      
      if (error) throw new Error(error.message);
    } catch (e: any) {
      console.error("Supabase updateSessionStatus error:", e);
      throw new Error(e.message || "Failed to update session status");
    }
  } else {
    // Local Mock Fallback
    const session = db.sessions.find(s => s.id === sessionId);
    if (session) {
      session.status = status;
      session.updated_at = now;
      session.updated_by = activeUserId;
      if (status === "active") {
        session.last_live_at = now;
      }
    }
  }

  // Broadcast via Pusher
  const sessionCode = await getSessionCodeById(sessionId);
  if (sessionCode && pusherServer) {
    try {
      await pusherServer.trigger(`session-${sessionCode}`, "session-status", { status });
      if (status === "active") {
        await pusherServer.trigger(`session-${sessionCode}`, "session-activated", {});
      } else {
        await pusherServer.trigger(`session-${sessionCode}`, "session-deactivated", {});
      }
    } catch (e) {
      console.error("Pusher updateSessionStatus trigger error:", e);
    }
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
      if (error) throw new Error(error.message);
      return;
    } catch (e: any) {
      console.error("Supabase deleteSession error:", e);
      throw new Error(e.message || "Failed to delete session");
    }
  }

  // Local Mock Fallback
  db.sessions = db.sessions.filter(s => s.id !== sessionId);
  const qIds = db.questions.filter(q => q.session_id === sessionId).map(q => q.id);
  db.questions = db.questions.filter(q => q.session_id !== sessionId);
  db.responses = db.responses.filter(r => !qIds.includes(r.question_id));
}

export async function getQuestions(sessionId: string): Promise<Question[]> {
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const isServer = typeof window === "undefined";
      const supabase = isServer ? await createServerClient() : createBrowserClient();
      
      // Try ordering by order_index first, then created_at
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      
      if (!error && data) return data as Question[];
      
      // Fallback in case order_index query fails
      if (error) {
        console.warn("order_index sort failed, falling back to created_at:", error);
        const { data: fallbackData } = await supabase
          .from("questions")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });
        if (fallbackData) return fallbackData as Question[];
      }
    } catch (e) {
      console.error("Supabase getQuestions error, falling back to mock:", e);
    }
  }

  // Local Mock Fallback
  return db.questions
    .filter(q => q.session_id === sessionId)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function createQuestion(
  sessionId: string,
  type: QuestionType,
  promptText: string,
  options: string[],
  correctOption?: number | null
): Promise<Question> {
  const sanitizedPrompt = sanitizeText(promptText);
  const sanitizedOptions = options.map(o => sanitizeText(o)).filter(o => o !== "");
  
  // Find current max order_index for this session
  let nextOrderIndex = 0;
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("questions")
        .select("order_index")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        nextOrderIndex = (data.order_index ?? 0) + 1;
      }
    } catch (e) {
      console.error("Error getting max order index:", e);
    }
  } else {
    const sessionQs = db.questions.filter(q => q.session_id === sessionId);
    if (sessionQs.length > 0) {
      nextOrderIndex = Math.max(...sessionQs.map(q => q.order_index ?? 0)) + 1;
    }
  }

  const isSupabase = isSupabaseConfigured() && !isMockId(sessionId);

  const newQuestion: Question = {
    id: isSupabase ? crypto.randomUUID() : `demo-${crypto.randomUUID()}`,
    session_id: sessionId,
    type,
    prompt_text: sanitizedPrompt !== "" ? sanitizedPrompt : "Untitled Question",
    options: type === "multiple_choice" ? sanitizedOptions : [],
    is_live: false,
    created_at: new Date().toISOString(),
    order_index: nextOrderIndex,
    correct_option: correctOption || null,
  };

  if (isSupabase) {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("questions")
        .insert(newQuestion)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      if (data) {
        await touchSession(sessionId);
        return data as Question;
      }
    } catch (e: any) {
      console.error("Supabase createQuestion error:", e);
      throw new Error(e.message || "Failed to create question");
    }
  }

  // Local Mock Fallback
  db.questions.push(newQuestion);
  await touchSession(sessionId);
  return newQuestion;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  let sessionId: string | null = null;
  
  if (isSupabaseConfigured() && !isMockId(questionId)) {
    try {
      const supabase = await createServerClient();
      const { data: q } = await supabase.from("questions").select("session_id").eq("id", questionId).maybeSingle();
      if (q) sessionId = q.session_id;

      const { error } = await supabase.from("questions").delete().eq("id", questionId);
      if (error) throw new Error(error.message);
    } catch (e: any) {
      console.error("Supabase deleteQuestion error:", e);
      throw new Error(e.message || "Failed to delete question");
    }
  } else {
    // Local Mock Fallback
    const q = db.questions.find(q => q.id === questionId);
    if (q) sessionId = q.session_id;
    db.questions = db.questions.filter(q => q.id !== questionId);
    db.responses = db.responses.filter(r => r.question_id !== questionId);
  }

  if (sessionId) {
    await touchSession(sessionId);
  }
}

export async function setQuestionLive(sessionId: string, questionId: string): Promise<void> {
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const supabase = await createServerClient();
      
      // Turn off live status for all other questions in session
      const { error: error1 } = await supabase
        .from("questions")
        .update({ is_live: false })
        .eq("session_id", sessionId);
      
      if (error1) throw new Error(error1.message);
      
      // Activate selected question
      const { error: error2 } = await supabase
        .from("questions")
        .update({ is_live: true })
        .eq("id", questionId);
      
      if (error2) throw new Error(error2.message);
    } catch (e: any) {
      console.error("Supabase setQuestionLive error:", e);
      throw new Error(e.message || "Failed to set question live");
    }
  } else {
    // Local Mock Fallback
    db.questions.forEach(q => {
      if (q.session_id === sessionId) {
        q.is_live = (q.id === questionId);
      }
    });
  }

  await touchSession(sessionId);

  // Broadcast via Pusher
  const sessionCode = await getSessionCodeById(sessionId);
  if (sessionCode && pusherServer) {
    try {
      await pusherServer.trigger(`session-${sessionCode}`, "questions-live", { questionId });
    } catch (e) {
      console.error("Pusher setQuestionLive trigger error:", e);
    }
  }
}

export async function getResponses(questionId: string): Promise<Response[]> {
  if (isSupabaseConfigured() && !isMockId(questionId)) {
    try {
      const isServer = typeof window === "undefined";
      const supabase = isServer ? await createServerClient() : createBrowserClient();
      const { data, error } = await supabase
        .from("responses")
        .select("*")
        .eq("question_id", questionId);
      
      if (!error && data) return data as Response[];
    } catch (e) {
      console.error("Supabase getResponses error, falling back to mock:", e);
    }
  }

  // Local Mock Fallback
  return db.responses.filter(r => r.question_id === questionId);
}

export async function submitResponse(
  questionId: string,
  participantId: string,
  value: string,
  pulseParticipantId?: string | null
): Promise<Response> {
  const sanitizedValue = sanitizeText(value);
  const newResponse: Response = {
    id: crypto.randomUUID(),
    question_id: questionId,
    participant_id: participantId,
    value: sanitizedValue,
    created_at: new Date().toISOString(),
    pulse_participant_id: pulseParticipantId || null,
  };

  let resolvedResponse = newResponse;

  if (isSupabaseConfigured() && !isMockId(questionId)) {
    try {
      const isServer = typeof window === "undefined";
      const supabase = isServer ? await createServerClient() : createBrowserClient();
      
      let dbParticipantId = pulseParticipantId || null;
      if (dbParticipantId) {
        if (isMockId(dbParticipantId)) {
          dbParticipantId = null;
        } else {
          // Verify if it exists in the database
          const { data: participantExists } = await supabase
            .from("pulse_participants")
            .select("id")
            .eq("id", dbParticipantId)
            .maybeSingle();
          if (!participantExists) {
            dbParticipantId = null;
          }
        }
      }

      // Check if participant has already responded
      const { data: existing, error: findError } = await supabase
        .from("responses")
        .select("id")
        .eq("question_id", questionId)
        .eq("participant_id", participantId)
        .maybeSingle();

      if (findError) throw new Error(findError.message);

      if (existing) {
        const { data, error } = await supabase
          .from("responses")
          .update({ 
            value: sanitizedValue, 
            created_at: new Date().toISOString(),
            pulse_participant_id: dbParticipantId
          })
          .eq("id", existing.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        if (data) resolvedResponse = data as Response;
      } else {
        const { data, error } = await supabase
          .from("responses")
          .insert({
            ...newResponse,
            pulse_participant_id: dbParticipantId
          })
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        if (data) resolvedResponse = data as Response;
      }
    } catch (e: any) {
      console.error("Supabase submitResponse error:", e);
      throw new Error(e.message || "Failed to submit response");
    }
  } else {
    // Local Mock Fallback
    // Remove existing response from this participant for this question (to prevent multiple submissions)
    db.responses = db.responses.filter(
      r => !(r.question_id === questionId && r.participant_id === participantId)
    );

    db.responses.push(newResponse);
  }

  // Broadcast via Pusher
  const sessionCode = await getSessionCodeByQuestionId(questionId);
  if (sessionCode && pusherServer) {
    try {
      await pusherServer.trigger(`session-${sessionCode}`, "new-vote", { questionId, response: resolvedResponse });
    } catch (e) {
      console.error("Pusher submitResponse trigger error:", e);
    }
  }

  return resolvedResponse;
}

export async function resetResponses(questionId: string): Promise<void> {
  if (isSupabaseConfigured() && !isMockId(questionId)) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.from("responses").delete().eq("question_id", questionId);
      if (error) throw new Error(error.message);
    } catch (e: any) {
      console.error("Supabase resetResponses error:", e);
      throw new Error(e.message || "Failed to reset responses");
    }
  } else {
    // Local Mock Fallback
    db.responses = db.responses.filter(r => r.question_id !== questionId);
  }

  // Broadcast via Pusher
  const sessionCode = await getSessionCodeByQuestionId(questionId);
  if (sessionCode && pusherServer) {
    try {
      await pusherServer.trigger(`session-${sessionCode}`, "responses-reset", { questionId });
    } catch (e) {
      console.error("Pusher resetResponses trigger error:", e);
    }
  }
}

export async function setQuestionsLive(sessionId: string, questionIds: string[]): Promise<void> {
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const supabase = await createServerClient();
      
      // Turn off live status for all other questions in session
      const { error: error1 } = await supabase
        .from("questions")
        .update({ is_live: false })
        .eq("session_id", sessionId);
      
      if (error1) throw new Error(error1.message);
      
      // Activate selected questions
      const { error: error2 } = await supabase
        .from("questions")
        .update({ is_live: true })
        .in("id", questionIds);
      
      if (error2) throw new Error(error2.message);
    } catch (e: any) {
      console.error("Supabase setQuestionsLive error:", e);
      throw new Error(e.message || "Failed to set questions live");
    }
  } else {
    // Local Mock Fallback
    db.questions.forEach(q => {
      if (q.session_id === sessionId) {
        q.is_live = questionIds.includes(q.id);
      }
    });
  }

  await touchSession(sessionId);

  // Broadcast via Pusher
  const sessionCode = await getSessionCodeById(sessionId);
  if (sessionCode && pusherServer) {
    try {
      // Fetch all questions for this session to get full details of live questions
      const allQuestions = isSupabaseConfigured()
        ? await getQuestions(sessionId)
        : db.questions.filter(q => q.session_id === sessionId);
      
      const liveList = allQuestions.filter(q => q.is_live);
      
      await pusherServer.trigger(`session-${sessionCode}`, "questions-live", { questions: liveList });
    } catch (e) {
      console.error("Pusher setQuestionsLive trigger error:", e);
    }
  }
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const sanitizedTitle = sanitizeText(title);
  const now = new Date().toISOString();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const activeUserId = user?.id || "demo-user-id";

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ 
          title: sanitizedTitle, 
          updated_at: now,
          updated_by: activeUserId
        })
        .eq("id", sessionId);
      
      if (error) throw new Error(error.message);
    } catch (e: any) {
      console.error("Supabase updateSessionTitle error:", e);
      throw new Error(e.message || "Failed to update session title");
    }
  } else {
    // Local Mock Fallback
    const session = db.sessions.find(s => s.id === sessionId);
    if (session) {
      session.title = sanitizedTitle !== "" ? sanitizedTitle : "Untitled Session";
      session.updated_at = now;
      session.updated_by = activeUserId;
    }
  }
}

export async function updateSessionAutoLaunch(
  sessionId: string,
  autoLaunch: boolean,
  timerSeconds: number
): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase
        .from("sessions")
        .update({ 
          auto_launch: autoLaunch, 
          timer_seconds: timerSeconds,
          updated_at: now
        })
        .eq("id", sessionId);
      
      if (error) throw new Error(error.message);
    } catch (e: any) {
      console.error("Supabase updateSessionAutoLaunch error:", e);
      throw new Error(e.message || "Failed to update session auto launch");
    }
  } else {
    // Local Mock Fallback
    const session = db.sessions.find(s => s.id === sessionId);
    if (session) {
      session.auto_launch = autoLaunch;
      session.timer_seconds = timerSeconds;
      session.updated_at = now;
    }
  }
}

export async function reorderQuestions(sessionId: string, questionIds: string[]): Promise<void> {
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const supabase = await createServerClient();
      
      const promises = questionIds.map((qId, index) => 
        supabase
          .from("questions")
          .update({ order_index: index })
          .eq("id", qId)
      );
      
      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError) throw new Error(firstError.error.message);
    } catch (e: any) {
      console.error("Supabase reorderQuestions error:", e);
      throw new Error(e.message || "Failed to reorder questions");
    }
  } else {
    // Local Mock Fallback
    questionIds.forEach((qId, index) => {
      const question = db.questions.find(q => q.id === qId);
      if (question) {
        question.order_index = index;
      }
    });
  }

  await touchSession(sessionId);
}

export async function syncUserProfile(userId: string, email: string, avatarUrl?: string | null): Promise<UserProfile> {
  const isVinay = email.toLowerCase() === "vinay1979@gmail.com";
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (isSupabaseConfigured() && uuidRegex.test(userId)) {
    try {
      const supabase = await createServerClient();
      
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      
      if (existing) {
        let needsUpdate = false;
        const updates: any = {};
        
        if (isVinay && (existing.role !== "super-admin" || existing.approval_status !== "approved")) {
          updates.role = "super-admin";
          updates.approval_status = "approved";
          needsUpdate = true;
        }
        
        if (avatarUrl && !existing.avatar_url) {
          updates.avatar_url = avatarUrl;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          updates.updated_at = new Date().toISOString();
          const { data: updated } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", userId)
            .select()
            .single();
          if (updated) return updated as UserProfile;
        }
        return existing as UserProfile;
      }
      
      const newProfile: UserProfile = {
        id: userId,
        email,
        role: isVinay ? "super-admin" : "power-user",
        approval_status: isVinay ? "approved" : "pending",
        avatar_url: avatarUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();
        
      if (created) return created as UserProfile;
      if (insertError) throw insertError;
    } catch (e) {
      logDbError("syncUserProfile", e);
    }
  }

  // Local Mock Fallback
  let profile = db.profiles.find(p => p.id === userId);
  if (!profile) {
    profile = {
      id: userId,
      email,
      role: isVinay ? "super-admin" : "power-user",
      approval_status: isVinay ? "approved" : "pending",
      avatar_url: avatarUrl || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.profiles.push(profile);
  } else {
    if (isVinay) {
      profile.role = "super-admin";
      profile.approval_status = "approved";
    }
    if (avatarUrl && !profile.avatar_url) {
      profile.avatar_url = avatarUrl;
    }
  }
  return profile;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("email", { ascending: true });
      
      if (!error && data) {
        // Sort pending first
        return (data as UserProfile[]).sort((a, b) => {
          if (a.approval_status === b.approval_status) return 0;
          return a.approval_status === "pending" ? -1 : 1;
        });
      }
    } catch (e) {
      logDbError("getAllUsers", e);
    }
  }
  return [...db.profiles].sort((a, b) => {
    if (a.approval_status === b.approval_status) {
      return a.email.localeCompare(b.email);
    }
    return a.approval_status === "pending" ? -1 : 1;
  });
}

export async function approveUser(userId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: "approved", updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
    } catch (e) {
      logDbError("approveUser", e);
      throw e;
    }
  } else {
    const profile = db.profiles.find(p => p.id === userId);
    if (profile) {
      profile.approval_status = "approved";
      profile.updated_at = new Date().toISOString();
    }
  }
}

export async function manuallyAddUser(email: string): Promise<UserProfile> {
  const sanitizedEmail = email.trim().toLowerCase();
  const userId = `p-invited-${crypto.randomUUID()}`;
  
  const newProfile: UserProfile = {
    id: userId,
    email: sanitizedEmail,
    role: "power-user",
    approval_status: "approved",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();
      if (error) throw error;
      if (data) return data as UserProfile;
    } catch (e) {
      logDbError("manuallyAddUser", e);
      throw e;
    }
  }

  db.profiles.push(newProfile);
  return newProfile;
}

export async function updateUserProfileAvatar(userId: string, avatarUrl: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", userId);
    } catch (e) {
      console.error("Supabase updateUserProfileAvatar error:", e);
    }
  } else {
    // Local Mock Fallback
    const profile = db.profiles.find(p => p.id === userId);
    if (profile) {
      profile.avatar_url = avatarUrl;
      profile.updated_at = new Date().toISOString();
    }
  }
}

export async function bulkImportQuestions(sessionId: string, questionsList: any[]): Promise<void> {
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const supabase = await createServerClient();
      
      const { data: existing } = await supabase
        .from("questions")
        .select("order_index")
        .eq("session_id", sessionId)
        .order("order_index", { ascending: false })
        .limit(1);
        
      let startIdx = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;
      
      const inserts = questionsList.map((q, idx) => ({
        id: crypto.randomUUID(),
        session_id: sessionId,
        type: q.type,
        prompt_text: sanitizeText(q.promptText),
        options: q.options,
        is_live: false,
        created_at: new Date().toISOString(),
        order_index: startIdx + idx,
        correct_option: q.correct_option || null,
      }));
      
      const { error } = await supabase
        .from("questions")
        .insert(inserts);
        
      if (error) throw error;
    } catch (e: any) {
      console.error("Supabase bulkImportQuestions error:", e);
      throw new Error(e.message || "Failed to bulk import questions");
    }
  } else {
    // Local Mock Fallback
    const existing = db.questions.filter(q => q.session_id === sessionId);
    let startIdx = existing.length > 0 ? Math.max(...existing.map(q => q.order_index)) + 1 : 0;
    
    questionsList.forEach((q, idx) => {
      db.questions.push({
        id: crypto.randomUUID(),
        session_id: sessionId,
        type: q.type,
        prompt_text: sanitizeText(q.promptText),
        options: q.options,
        is_live: false,
        created_at: new Date().toISOString(),
        order_index: startIdx + idx,
        correct_option: q.correct_option || null,
      });
    });
  }

  await touchSession(sessionId);
}

export async function cleanupTestData(userId: string): Promise<void> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (isSupabaseConfigured() && uuidRegex.test(userId)) {
    try {
      const supabase = await createServerClient();
      
      // Fetch all session IDs for this user
      const { data: sessions, error: fetchErr } = await supabase
        .from("sessions")
        .select("id")
        .eq("created_by", userId);
        
      if (fetchErr) throw fetchErr;
      
      if (sessions && sessions.length > 0) {
        // filter out seed sessions
        const sIds = (sessions as { id: string }[])
          .map((s: { id: string }) => s.id)
          .filter(id => id !== "demo-session-uuid" && id !== "inactive-demo-uuid");
          
        if (sIds.length > 0) {
          const { error: deleteErr } = await supabase
            .from("sessions")
            .delete()
            .in("id", sIds);
          if (deleteErr) throw deleteErr;
        }
      }
    } catch (e) {
      logDbError("cleanupTestData", e);
    }
  } else {
    // Local Mock Fallback
    const testSessions = db.sessions.filter(
      s => s.created_by === userId && s.id !== "demo-session-uuid" && s.id !== "inactive-demo-uuid"
    );
    const testSessionIds = testSessions.map(s => s.id);
    
    db.sessions = db.sessions.filter(s => !testSessionIds.includes(s.id));
    
    const testQuestionIds = db.questions
      .filter(q => testSessionIds.includes(q.session_id))
      .map(q => q.id);
      
    db.questions = db.questions.filter(q => !testSessionIds.includes(q.session_id));
    db.responses = db.responses.filter(r => !testQuestionIds.includes(r.question_id));
    if (db.pulse_participants) {
      db.pulse_participants = db.pulse_participants.filter(p => !testSessionIds.includes(p.session_id));
    }
  }
}

export async function registerParticipant(
  sessionId: string,
  name: string,
  email: string
): Promise<PulseParticipant> {
  const sanitizedName = sanitizeText(name);
  const sanitizedEmail = sanitizeText(email).toLowerCase();

  const newParticipant: PulseParticipant = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    name: sanitizedName,
    email: sanitizedEmail,
    score: 0,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      
      // Check if participant already exists in this session by email
      const { data: existing, error: findError } = await supabase
        .from("pulse_participants")
        .select("*")
        .eq("session_id", sessionId)
        .eq("email", sanitizedEmail)
        .maybeSingle();

      if (findError) throw findError;
      if (existing) return existing as PulseParticipant;

      // Insert new participant using admin client
      const { data, error } = await supabase
        .from("pulse_participants")
        .insert(newParticipant)
        .select()
        .single();

      if (error) throw error;
      if (data) return data as PulseParticipant;
    } catch (e) {
      logDbError("registerParticipant", e);
    }
  }

  // Local Mock Fallback
  if (!db.pulse_participants) {
    db.pulse_participants = [];
  }
  let participant = db.pulse_participants.find(
    p => p.session_id === sessionId && p.email === sanitizedEmail
  );
  if (!participant) {
    participant = newParticipant;
    db.pulse_participants.push(participant);
  }
  return participant;
}

export async function getParticipants(sessionId: string): Promise<PulseParticipant[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();
      
      const { data, error } = await supabase
        .from("pulse_participants")
        .select("*")
        .eq("session_id", sessionId)
        .order("score", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;
      if (data) return data as PulseParticipant[];
    } catch (e) {
      logDbError("getParticipants", e);
    }
  }

  // Local Mock Fallback
  if (!db.pulse_participants) {
    db.pulse_participants = [];
  }
  return db.pulse_participants
    .filter(p => p.session_id === sessionId)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export async function getAttemptedParticipantsCount(sessionId: string): Promise<number> {
  if (isSupabaseConfigured() && !isMockId(sessionId)) {
    try {
      const supabase = createAdminClient();
      
      const { data: questions } = await supabase
        .from("questions")
        .select("id")
        .eq("session_id", sessionId);
      
      if (!questions || questions.length === 0) return 0;
      
      const questionIds = questions.map(q => q.id);
      
      const { data: responses, error } = await supabase
        .from("responses")
        .select("participant_id, pulse_participant_id")
        .in("question_id", questionIds);
      
      if (error) throw error;
      
      const uniqueIds = new Set(
        (responses || []).map(r => r.pulse_participant_id || r.participant_id)
      );
      return uniqueIds.size;
    } catch (e) {
      logDbError("getAttemptedParticipantsCount", e);
    }
  }
  
  // Local Mock Fallback
  const qIds = db.questions.filter(q => q.session_id === sessionId).map(q => q.id);
  const responses = db.responses.filter(r => qIds.includes(r.question_id));
  const uniqueIds = new Set(responses.map(r => r.pulse_participant_id || r.participant_id));
  return uniqueIds.size;
}

export async function calculateScores(
  questionId: string,
  correctOption: number
): Promise<void> {
  // correctOption is 1-indexed (e.g. 1 to 8). In responses, "value" is stored as string matching option index (0-indexed, like "0", "1")
  const correctOptionValueStr = (correctOption - 1).toString();

  if (isSupabaseConfigured()) {
    try {
      const supabase = createAdminClient();

      // 1. Get the question's session_id to broadcast and match
      const { data: question, error: qError } = await supabase
        .from("questions")
        .select("session_id")
        .eq("id", questionId)
        .maybeSingle();

      if (qError) throw qError;
      if (!question) return;

      const sessionId = question.session_id;

      // 2. Fetch all responses for this question
      const { data: responses, error: rError } = await supabase
        .from("responses")
        .select("*")
        .eq("question_id", questionId);

      if (rError) throw rError;

      // 3. Find participants who answered correctly
      const correctResponses = (responses || []).filter(
        r => r.value === correctOptionValueStr && r.pulse_participant_id
      );

      if (correctResponses.length > 0) {
        const participantIds = correctResponses.map(r => r.pulse_participant_id);

        // Fetch the participants first:
        const { data: participantsToUpdate, error: pError } = await supabase
          .from("pulse_participants")
          .select("id, score")
          .in("id", participantIds);

        if (!pError && participantsToUpdate) {
          const promises = participantsToUpdate.map(p =>
            supabase
              .from("pulse_participants")
              .update({ score: p.score + 10 })
              .eq("id", p.id)
          );
          await Promise.all(promises);
        }
      }

      // Broadcast via Pusher that leaderboard has updated
      const sessionCode = await getSessionCodeById(sessionId);
      if (sessionCode && pusherServer) {
        try {
          await pusherServer.trigger(`session-${sessionCode}`, "leaderboard-updated", {});
        } catch (e) {
          console.error("Pusher leaderboard-updated trigger error:", e);
        }
      }
      return;
    } catch (e) {
      logDbError("calculateScores", e);
    }
  }

  // Local Mock Fallback
  if (!db.pulse_participants) {
    db.pulse_participants = [];
  }
  const mockResponses = db.responses.filter(r => r.question_id === questionId);
  const correctMockResponses = mockResponses.filter(
    r => r.value === correctOptionValueStr && r.pulse_participant_id
  );

  correctMockResponses.forEach(r => {
    const participant = db.pulse_participants.find(p => p.id === r.pulse_participant_id);
    if (participant) {
      participant.score += 10;
    }
  });

  const mockQuestion = db.questions.find(q => q.id === questionId);
  if (mockQuestion) {
    const sessionCode = await getSessionCodeById(mockQuestion.session_id);
    if (sessionCode && pusherServer) {
      try {
        await pusherServer.trigger(`session-${sessionCode}`, "leaderboard-updated", {});
      } catch (e) {
        console.error("Pusher mock leaderboard-updated trigger error:", e);
      }
    }
  }
}

