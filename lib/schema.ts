export type SessionStatus = "active" | "inactive";
export type QuestionType = "multiple_choice" | "word_cloud";

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
  created_at: string;
  updated_at?: string | null;
  order_index: number;
}

export interface Response {
  id: string;
  question_id: string;
  participant_id: string; // Anonymous, stored in participant localStorage
  value: string; // Option index or word text
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "super-admin" | "power-user";
  approval_status: "pending" | "approved";
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}
