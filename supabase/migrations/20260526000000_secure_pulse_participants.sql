-- 1. Create the pulse_participants table for temporary logins
CREATE TABLE IF NOT EXISTS pulse_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS) on pulse_participants
ALTER TABLE pulse_participants ENABLE ROW LEVEL SECURITY;

-- 3. Create a SELECT policy (Read access to everyone) for the Live Leaderboard
DROP POLICY IF EXISTS "Allow public read access to pulse_participants" ON pulse_participants;
CREATE POLICY "Allow public read access to pulse_participants" 
ON pulse_participants 
FOR SELECT 
USING (true);

-- 4. Extend the responses table to link to pulse_participants
ALTER TABLE responses 
ADD COLUMN IF NOT EXISTS pulse_participant_id UUID REFERENCES pulse_participants(id) ON DELETE CASCADE;

-- 5. Create an index to optimize participant queries
CREATE INDEX IF NOT EXISTS idx_pulse_participants_session ON pulse_participants(session_id);
