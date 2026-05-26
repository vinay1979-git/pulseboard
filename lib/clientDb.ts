import { isSupabaseConfigured } from "./env";
import type { Session, Question, Response, SessionStatus, QuestionType, UserProfile } from "./schema";

// Universal client DB helper that routes through our API or directly to Supabase
async function apiCall(action: string, args: any = {}) {
  // Add a dynamic timestamp to completely bypass any caching (very important for Next.js Turbopack)
  const response = await fetch(`/api/db?t=${Date.now()}`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    },
    cache: "no-store",
    body: JSON.stringify({ action, ...args }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "API call failed");
  }
  return response.json();
}

export async function getSessions(userId: string): Promise<Session[]> {
  return apiCall("getSessions", { userId });
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  return apiCall("getSessionByCode", { code });
}

export async function createSession(userId: string, title: string): Promise<Session> {
  return apiCall("createSession", { userId, title });
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  return apiCall("updateSessionStatus", { sessionId, status });
}

export async function deleteSession(sessionId: string): Promise<void> {
  return apiCall("deleteSession", { sessionId });
}

export async function getQuestions(sessionId: string): Promise<Question[]> {
  return apiCall("getQuestions", { sessionId });
}

export async function createQuestion(
  sessionId: string,
  type: QuestionType,
  promptText: string,
  options: string[]
): Promise<Question> {
  return apiCall("createQuestion", { sessionId, type, promptText, options });
}

export async function deleteQuestion(questionId: string): Promise<void> {
  return apiCall("deleteQuestion", { questionId });
}

export async function setQuestionLive(sessionId: string, questionId: string): Promise<void> {
  return apiCall("setQuestionLive", { sessionId, questionId });
}

export async function getResponses(questionId: string): Promise<Response[]> {
  return apiCall("getResponses", { questionId });
}

export async function submitResponse(
  questionId: string,
  participantId: string,
  value: string
): Promise<Response> {
  return apiCall("submitResponse", { questionId, participantId, value });
}

export async function resetResponses(questionId: string): Promise<void> {
  return apiCall("resetResponses", { questionId });
}

export async function setQuestionsLive(sessionId: string, questionIds: string[]): Promise<void> {
  return apiCall("setQuestionsLive", { sessionId, questionIds });
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  return apiCall("updateSessionTitle", { sessionId, title });
}

export async function reorderQuestions(sessionId: string, questionIds: string[]): Promise<void> {
  return apiCall("reorderQuestions", { sessionId, questionIds });
}

export async function syncUserProfile(userId: string, email: string, avatarUrl?: string | null): Promise<UserProfile> {
  return apiCall("syncUserProfile", { userId, email, avatarUrl });
}

export async function updateUserProfileAvatar(userId: string, avatarUrl: string): Promise<void> {
  return apiCall("updateUserProfileAvatar", { userId, avatarUrl });
}

export async function bulkImportQuestions(sessionId: string, questionsList: any[]): Promise<void> {
  return apiCall("bulkImportQuestions", { sessionId, questionsList });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  return apiCall("getAllUsers");
}

export async function approveUser(userId: string): Promise<void> {
  return apiCall("approveUser", { userId });
}

export async function manuallyAddUser(email: string): Promise<UserProfile> {
  return apiCall("manuallyAddUser", { email });
}

export async function cleanupTestData(userId: string): Promise<void> {
  return apiCall("cleanupTestData", { userId });
}
