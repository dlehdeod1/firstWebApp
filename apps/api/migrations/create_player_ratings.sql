-- Player Ratings Table
-- Stores individual ratings given by users to players
-- Privacy: detailed ratings visible only to player and admins

CREATE TABLE IF NOT EXISTS player_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,          -- Player being rated
    rater_user_id INTEGER NOT NULL,      -- User giving the rating
    session_id INTEGER,                   -- Optional: rating for specific session
    
    -- Ratings (1-10 scale)
    shooting INTEGER CHECK(shooting BETWEEN 1 AND 10),
    offball_run INTEGER CHECK(offball_run BETWEEN 1 AND 10),
    ball_keeping INTEGER CHECK(ball_keeping BETWEEN 1 AND 10),
    passing INTEGER CHECK(passing BETWEEN 1 AND 10),
    intercept INTEGER CHECK(intercept BETWEEN 1 AND 10),
    marking INTEGER CHECK(marking BETWEEN 1 AND 10),
    stamina INTEGER CHECK(stamina BETWEEN 1 AND 10),
    speed INTEGER CHECK(speed BETWEEN 1 AND 10),
    
    -- Overall rating (computed or direct)
    overall INTEGER CHECK(overall BETWEEN 1 AND 10),
    
    -- Metadata
    comment TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (rater_user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    
    -- One rating per player per session per rater
    UNIQUE(player_id, rater_user_id, session_id)
);

-- Index for querying ratings by player
CREATE INDEX IF NOT EXISTS idx_player_ratings_player ON player_ratings(player_id);
-- Index for querying ratings by rater
CREATE INDEX IF NOT EXISTS idx_player_ratings_rater ON player_ratings(rater_user_id);
