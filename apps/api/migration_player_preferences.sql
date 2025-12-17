-- Player Preferences (Chemistry 1st, 2nd, 3rd pick)
CREATE TABLE IF NOT EXISTS player_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  target_player_id INTEGER NOT NULL,
  rank INTEGER NOT NULL, -- 1, 2, 3
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (target_player_id) REFERENCES players(id),
  UNIQUE(player_id, rank), -- One player per rank for a user
  UNIQUE(player_id, target_player_id) -- Cannot pick same player twice
);
