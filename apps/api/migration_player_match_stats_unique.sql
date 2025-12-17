-- Add UNIQUE constraint to player_match_stats for ON CONFLICT support
-- SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we recreate the table

-- Step 1: Create new table with constraint
CREATE TABLE IF NOT EXISTS player_match_stats_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    blocks INTEGER DEFAULT 0,
    key_passes INTEGER DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE(player_id, match_id)
);

-- Step 2: Copy existing data
INSERT OR IGNORE INTO player_match_stats_new (id, match_id, player_id, goals, assists, saves, blocks, key_passes, notes)
SELECT id, match_id, player_id, goals, assists, saves, blocks, key_passes, notes FROM player_match_stats;

-- Step 3: Drop old table
DROP TABLE IF EXISTS player_match_stats;

-- Step 4: Rename new table
ALTER TABLE player_match_stats_new RENAME TO player_match_stats;
