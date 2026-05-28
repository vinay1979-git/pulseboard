-- Redesign the responses table to act as an immutable ledger
ALTER TABLE responses ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS selected_option VARCHAR(255);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS is_correct BOOLEAN DEFAULT false;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;

-- Establish index to optimize session queries on ledger
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);

-- Drop RLS on responses or ensure appropriate policies exist
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to responses" ON responses;
CREATE POLICY "Allow public read access to responses"
ON responses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access to responses" ON responses;
CREATE POLICY "Allow public insert access to responses"
ON responses FOR INSERT WITH CHECK (true);

-- Rebuild PostgREST API schema cache
NOTIFY pgrst, 'reload schema';
