import { isSupabaseConfigured } from "@/lib/env";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Session, Question, Response, UserProfile, SessionStatus, QuestionType } from "./schema";
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
    ]
  };
}

const db = globalForDb._pulseboardDb;

function sanitizeText(text: string): string {
  if (!text) return "";
  // Strip HTML tags and scripts to prevent XSS injections
  return text.replace(/<[^>]*>/g, "").trim();
}

async function getSessionCodeById(sessionId: string): Promise<string | null> {
  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
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

export async function getSessions(userId: string): Promise<Session[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("created_by", userId)
        .order("updated_at", { ascending: false });
      
      if (!error && data) return data as Session[];
    } catch (e) {
      console.error("Supabase getSessions error, falling back to mock:", e);
    }
  }
  
  // Local Mock Fallback
  return db.sessions.filter(s => s.created_by === userId || s.created_by === "demo-user-id");
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  if (isSupabaseConfigured()) {
    try {
      // Need a client that bypasses complex SSR cookies if running client-side,
      // let's use the browser client if in browser, or server client if in server.
      const isServer = typeof window === "undefined";
      const supabase = isServer ? await createServerClient() : createBrowserClient();
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      
      if (!error && data) return data as Session;
    } catch (e) {
      console.error("Supabase getSessionByCode error, falling back to mock:", e);
    }
  }
  
  // Local Mock Fallback
  const session = db.sessions.find(s => s.code === code);
  return session ?? null;
}

export async function createSession(userId: string, title: string): Promise<Session> {
  // Generate random unique 6-digit code
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }

  const sanitizedTitle = sanitizeText(title);
  const newSession: Session = {
    id: crypto.randomUUID(),
    code,
    title: sanitizedTitle !== "" ? sanitizedTitle : "New Polling Session",
    status: "inactive",
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
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

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase
        .from("sessions")
        .update({ status, updated_at: new Date().toISOString() })
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
      session.updated_at = new Date().toISOString();
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
  db.questions = db.questions.filter(q => q.session_id !== sessionId);
}

export async function getQuestions(sessionId: string): Promise<Question[]> {
  if (isSupabaseConfigured()) {
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
  options: string[]
): Promise<Question> {
  const sanitizedPrompt = sanitizeText(promptText);
  const sanitizedOptions = options.map(o => sanitizeText(o)).filter(o => o !== "");
  
  // Find current max order_index for this session
  let nextOrderIndex = 0;
  if (isSupabaseConfigured()) {
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

  const newQuestion: Question = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    type,
    prompt_text: sanitizedPrompt !== "" ? sanitizedPrompt : "Untitled Question",
    options: type === "multiple_choice" ? sanitizedOptions : [],
    is_live: false,
    created_at: new Date().toISOString(),
    order_index: nextOrderIndex,
  };

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("questions")
        .insert(newQuestion)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      if (data) return data as Question;
    } catch (e: any) {
      console.error("Supabase createQuestion error:", e);
      throw new Error(e.message || "Failed to create question");
    }
  }

  // Local Mock Fallback
  db.questions.push(newQuestion);
  return newQuestion;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.from("questions").delete().eq("id", questionId);
      if (error) throw new Error(error.message);
      return;
    } catch (e: any) {
      console.error("Supabase deleteQuestion error:", e);
      throw new Error(e.message || "Failed to delete question");
    }
  }

  // Local Mock Fallback
  db.questions = db.questions.filter(q => q.id !== questionId);
  db.responses = db.responses.filter(r => r.question_id !== questionId);
}

export async function setQuestionLive(sessionId: string, questionId: string): Promise<void> {
  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
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
  value: string
): Promise<Response> {
  const sanitizedValue = sanitizeText(value);
  const newResponse: Response = {
    id: crypto.randomUUID(),
    question_id: questionId,
    participant_id: participantId,
    value: sanitizedValue,
    created_at: new Date().toISOString(),
  };

  let resolvedResponse = newResponse;

  if (isSupabaseConfigured()) {
    try {
      const isServer = typeof window === "undefined";
      const supabase = isServer ? await createServerClient() : createBrowserClient();
      
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
          .update({ value: sanitizedValue, created_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single();
        
        if (error) throw new Error(error.message);
        if (data) resolvedResponse = data as Response;
      } else {
        const { data, error } = await supabase
          .from("responses")
          .insert(newResponse)
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
  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase
        .from("sessions")
        .update({ title: sanitizedTitle, updated_at: new Date().toISOString() })
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
      session.updated_at = new Date().toISOString();
    }
  }
}

export async function reorderQuestions(sessionId: string, questionIds: string[]): Promise<void> {
  if (isSupabaseConfigured()) {
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
}

export async function syncUserProfile(userId: string, email: string): Promise<UserProfile> {
  const isVinay = email.toLowerCase() === "vinay1979@gmail.com";
  
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerClient();
      
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      
      if (existing) {
        if (isVinay && (existing.role !== "super-admin" || existing.approval_status !== "approved")) {
          const { data: updated } = await supabase
            .from("profiles")
            .update({ role: "super-admin", approval_status: "approved", updated_at: new Date().toISOString() })
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.profiles.push(profile);
  } else {
    if (isVinay) {
      profile.role = "super-admin";
      profile.approval_status = "approved";
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
