-- Migration: Make email optional in users table
PRAGMA foreign_keys=OFF;

-- 1. Create new table with nullable email
CREATE TABLE users_new (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT, -- Removed NOT NULL (if it was there implicitly or explicitly)
    password TEXT,
    role TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

-- 2. Copy data
INSERT INTO users_new (id, username, email, password, role, created_at, updated_at)
SELECT id, username, email, password, role, created_at, updated_at FROM users;

-- 3. Drop old table
DROP TABLE users;

-- 4. Rename new table
ALTER TABLE users_new RENAME TO users;
