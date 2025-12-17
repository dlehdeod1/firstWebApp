-- Player Stat Changes Log (for daily limit tracking)
CREATE TABLE IF NOT EXISTS stat_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    stat TEXT NOT NULL, -- 'shooting', 'passing', 'stamina', 'defense', 'sense', 'speed'
    delta REAL NOT NULL,
    reason TEXT, -- 'Goal', 'Assist', 'Attendance', '3 Streak Attendance'
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Index for daily limit query performance
CREATE INDEX IF NOT EXISTS idx_stat_changes_player_date ON stat_changes(player_id, created_at);
