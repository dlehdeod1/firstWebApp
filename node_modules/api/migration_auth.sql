-- Recreate users table with all required columns
CREATE TABLE IF NOT EXISTS users_new (
    id TEXT PRIMARY KEY,
    email TEXT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO users_new (id, email, role, created_at)
SELECT id, email, role, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    alias TEXT,
    phone TEXT,
    birth_date TEXT,
    height_cm INTEGER,
    weight_kg INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recreate players table with player_code and link_status
CREATE TABLE IF NOT EXISTS players_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    name TEXT NOT NULL,
    nickname TEXT,
    aliases_json TEXT DEFAULT '[]',
    join_date TEXT,
    age INTEGER,
    height_cm INTEGER,
    weight_kg INTEGER,
    shooting INTEGER DEFAULT 5,
    offball_run INTEGER DEFAULT 5,
    ball_keeping INTEGER DEFAULT 5,
    passing INTEGER DEFAULT 5,
    intercept INTEGER DEFAULT 5,
    marking INTEGER DEFAULT 5,
    stamina INTEGER DEFAULT 5,
    speed INTEGER DEFAULT 5,
    pay_exempt INTEGER DEFAULT 0,
    notes TEXT,
    player_code TEXT UNIQUE,
    link_status TEXT DEFAULT 'UNLINKED',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO players_new (id, user_id, name, nickname, aliases_json, join_date, age, height_cm, weight_kg, shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, pay_exempt, notes, created_at, updated_at)
SELECT id, user_id, name, nickname, aliases_json, join_date, age, height_cm, weight_kg, shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, pay_exempt, notes, created_at, updated_at FROM players;

DROP TABLE players;
ALTER TABLE players_new RENAME TO players;
