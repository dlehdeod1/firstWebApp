-- Create admin user
INSERT OR IGNORE INTO users (id, email, username, password, role, created_at, updated_at)
VALUES (
    'admin-001',
    'admin@conerkicks.com',
    'admin',
    'admin123',
    'ADMIN',
    unixepoch(),
    unixepoch()
);

-- Create admin profile
INSERT OR IGNORE INTO profiles (user_id, alias, created_at, updated_at)
VALUES (
    'admin-001',
    '관리자',
    unixepoch(),
    unixepoch()
);
