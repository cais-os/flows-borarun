-- Add timeout_at column used by waitTimer and waitForPlayed nodes
-- to track when a paused flow should auto-resume.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS timeout_at timestamptz;
