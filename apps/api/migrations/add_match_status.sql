-- Add status column to matches table for tracking match state
-- Values: 'pending' (scheduled), 'in_progress' (being played), 'completed' (finished)

ALTER TABLE matches ADD COLUMN status TEXT DEFAULT 'pending';

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
