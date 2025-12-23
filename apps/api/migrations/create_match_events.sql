-- Match Events Table - stores individual events for editing/deletion
-- This allows tracking each goal, assist, etc. separately

CREATE TABLE IF NOT EXISTS match_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'GOAL', 'ASSIST', 'KEY_PASS', 'BLOCK', 'CLEARANCE'
    assister_id INTEGER, -- only for goals with assists
    event_time INTEGER, -- elapsed seconds when event occurred
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (assister_id) REFERENCES players(id)
);

-- Index for querying events by match
CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);
