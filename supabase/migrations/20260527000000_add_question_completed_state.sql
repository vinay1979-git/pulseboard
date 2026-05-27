-- Add is_completed column to questions table to track completed state
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false;

-- Add index to speed up completed state queries
CREATE INDEX IF NOT EXISTS idx_questions_is_completed ON questions(is_completed);
