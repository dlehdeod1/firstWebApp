-- Capabilities / Stats System
CREATE TABLE IF NOT EXISTS abilities (
    user_id TEXT PRIMARY KEY,
    -- Base Values (Set by Admin)
    base_attack INTEGER DEFAULT 50,
    base_playmaker INTEGER DEFAULT 50,
    base_competitiveness INTEGER DEFAULT 50,
    base_diligence INTEGER DEFAULT 50,
    -- Current Calculated Values (Cached for display)
    curr_attack REAL DEFAULT 50,
    curr_playmaker REAL DEFAULT 50,
    curr_competitiveness REAL DEFAULT 50,
    curr_diligence REAL DEFAULT 50,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ability_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    stat_type TEXT, -- 'ATTACK', 'PLAYMAKER', 'COMPETITIVE', 'DILIGENCE'
    delta REAL,
    reason TEXT, -- 'GOAL', 'ASSIST', 'WIN', 'ATTEND'
    match_id INTEGER, -- Optional
    session_id INTEGER, -- Optional
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
