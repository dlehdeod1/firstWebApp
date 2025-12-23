-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- uuid
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Invites table (for invite-only auth)
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  email TEXT, -- optional restriction
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT, -- Link to users table (nullable initially)
  name TEXT NOT NULL,
  nickname TEXT,
  aliases_json TEXT DEFAULT '[]', -- JSON array of strings
  join_date TEXT, -- YYYY-MM-DD
  age INTEGER,
  height_cm INTEGER,
  weight_kg INTEGER,
  
  -- Stats (1-10)
  shooting INTEGER DEFAULT 5,
  offball_run INTEGER DEFAULT 5,
  ball_keeping INTEGER DEFAULT 5,
  passing INTEGER DEFAULT 5,
  intercept INTEGER DEFAULT 5,
  marking INTEGER DEFAULT 5,
  stamina INTEGER DEFAULT 5,
  speed INTEGER DEFAULT 5,
  
  pay_exempt INTEGER DEFAULT 0, -- boolean 0/1, for president/manager
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Chemistry Edges
CREATE TABLE IF NOT EXISTS chemistry_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_a_id INTEGER NOT NULL,
  player_b_id INTEGER NOT NULL,
  chemistry_score INTEGER NOT NULL DEFAULT 0, -- -5 to +5
  note TEXT,
  FOREIGN KEY (player_a_id) REFERENCES players(id),
  FOREIGN KEY (player_b_id) REFERENCES players(id),
  UNIQUE(player_a_id, player_b_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_date TEXT NOT NULL, -- YYYY-MM-DD
  title TEXT,
  pot_total INTEGER DEFAULT 120000,
  base_fee INTEGER DEFAULT 6000,
  status TEXT DEFAULT 'recruiting', -- 'recruiting', 'closed', 'finished'
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Attendance (Many-to-Many Session-Player)
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE(session_id, player_id)
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  rank INTEGER, -- 1, 2, 3
  score_stats TEXT, -- JSON snapshot of team stats sum
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE(team_id, player_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  match_no INTEGER, -- 1, 2, 3...
  team1_id INTEGER NOT NULL,
  team2_id INTEGER NOT NULL,
  team1_score INTEGER DEFAULT 0,
  team2_score INTEGER DEFAULT 0,
  duration_min INTEGER DEFAULT 10,
  played_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (team1_id) REFERENCES teams(id),
  FOREIGN KEY (team2_id) REFERENCES teams(id)
);

-- Player Match Stats (Granular stats per match)
CREATE TABLE IF NOT EXISTS player_match_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  blocks INTEGER DEFAULT 0,
  key_passes INTEGER DEFAULT 0,
  clearances INTEGER DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (match_id) REFERENCES matches(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE(player_id, match_id)
);

-- Rating Change Log
CREATE TABLE IF NOT EXISTS rating_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  session_id INTEGER,
  diff_json TEXT NOT NULL, -- JSON { "shooting": +1, "speed": -1 }
  reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
