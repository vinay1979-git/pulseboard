export type SessionStatus = "active" | "inactive";
export type QuestionType = "multiple_choice" | "word_cloud";
export type AuthMode = "anonymous" | "gmail" | "quiz_gmail";

export interface Session {
  id: string;
  code: string; // Unique 6-digit session code (e.g. "823901")
  title: string; // Friendly name for the presentation session
  status: SessionStatus;
  created_by: string;
  updated_by?: string | null;
  last_live_at?: string | null;
  created_at: string;
  updated_at: string;
  auth_mode?: AuthMode;
  auto_launch?: boolean;
  timer_seconds?: number;
  // Creator & modifier display metadata
  creator_email?: string;
  creator_name?: string;
  updater_email?: string;
  updater_name?: string;
  creator?: { full_name: string; email: string } | null;
  updater?: { full_name: string; email: string } | null;
}

export interface Question {
  id: string;
  session_id: string;
  type: QuestionType;
  prompt_text: string;
  options: string[]; // Options for multiple choice (empty for word cloud)
  is_live: boolean;
  is_completed?: boolean;
  created_at: string;
  updated_at?: string | null;
  order_index: number;
  correct_option?: number | null; // 1-indexed correct answer (1-8)
}

export interface Response {
  id: string;
  question_id: string;
  participant_id: string; // Anonymous, stored in participant localStorage
  value: string; // Option index or word text
  created_at: string;
  pulse_participant_id?: string | null;
  session_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  selected_option?: string | null;
  is_correct?: boolean;
  points_awarded?: number;
  status?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "super-admin" | "power-user" | "participant" | "voter";
  approval_status: "pending" | "approved";
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PulseParticipant {
  id: string;
  session_id: string;
  name: string;
  email: string;
  score: number;
  created_at: string;
}

