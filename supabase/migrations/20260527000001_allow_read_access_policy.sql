-- Drop existing select policies on pulse_participants if they exist
DROP POLICY IF EXISTS "Allow public read access to pulse_participants" ON pulse_participants;
DROP POLICY IF EXISTS "Allow read access to all" ON pulse_participants;

-- Establish a broad SELECT policy allowing public read access
CREATE POLICY "Allow read access to all" 
ON pulse_participants 
FOR SELECT 
USING (true);

-- Notify schema cache reload
NOTIFY pgrst, 'reload schema';
