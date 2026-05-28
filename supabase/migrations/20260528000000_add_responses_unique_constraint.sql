-- UNIFIED RESPONSES LEDGER & UNIQUE CONSTRAINT MIGRATION
-- This script safely sets up the ledger columns, establishes policies, cleans duplicates, and enforces idempotency.

-- 1. Add ledger columns to responses table if they don't exist
ALTER TABLE responses ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS selected_option VARCHAR(255);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS is_correct BOOLEAN DEFAULT false;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;

-- 2. Establish index for session queries optimization
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);

-- 3. Ensure Row Level Security and appropriate policies exist
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to responses" ON responses;
CREATE POLICY "Allow public read access to responses" 
ON responses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access to responses" ON responses;
CREATE POLICY "Allow public insert access to responses" 
ON responses FOR INSERT WITH CHECK (true);

-- 4. Clean up any existing duplicate entries (keeping the most recently created response)
DELETE FROM responses a USING responses b
WHERE a.created_at < b.created_at
  AND a.session_id = b.session_id
  AND a.question_id = b.question_id
  AND COALESCE(a.user_email, '') = COALESCE(b.user_email, '');

-- 5. Add unique constraint to prevent future duplicate submissions
ALTER TABLE responses DROP CONSTRAINT IF EXISTS unique_user_question;
ALTER TABLE responses ADD CONSTRAINT unique_user_question UNIQUE (session_id, question_id, user_email);

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
