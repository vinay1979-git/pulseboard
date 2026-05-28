-- Add unique constraint to pulse_participants table to enable atomic upsert and prevent duplicates per session
ALTER TABLE pulse_participants DROP CONSTRAINT IF EXISTS unique_session_email;
ALTER TABLE pulse_participants ADD CONSTRAINT unique_session_email UNIQUE (session_id, email);

-- Drop existing write policies if they exist to prevent duplication
DROP POLICY IF EXISTS "Allow public insert access to pulse_participants" ON pulse_participants;
DROP POLICY IF EXISTS "Allow public update access to pulse_participants" ON pulse_participants;

-- Create policies to allow public write access for attendee registrations and scoring
CREATE POLICY "Allow public insert access to pulse_participants"
ON pulse_participants
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to pulse_participants"
ON pulse_participants
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Rebuild PostgREST API schema cache
NOTIFY pgrst, 'reload schema';
