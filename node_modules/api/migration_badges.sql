-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    condition_type TEXT, -- 'PLACEMENT', 'GOAL', 'ASSIST', 'ATTENDANCE'
    threshold INTEGER
);

-- Create player_badges table (player 기준 - 나중에 user 연결 시 기록 유지)
CREATE TABLE IF NOT EXISTS player_badges (
    player_id INTEGER,
    badge_code TEXT,
    earned_at INTEGER,
    PRIMARY KEY (player_id, badge_code),
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (badge_code) REFERENCES badges(code)
);

-- Seed Badges (BadgeService에서 사용하는 코드와 일치)
INSERT OR IGNORE INTO badges (code, name, description, condition_type, threshold) VALUES
('first_goal', '데뷔골', '통산 1골 달성', 'GOAL', 1),
('goal_5', '스트라이커', '통산 5골 달성', 'GOAL', 5),
('goal_10', '득점 기계', '통산 10골 달성', 'GOAL', 10),
('assist_5', '특급 도우미', '통산 5도움 달성', 'ASSIST', 5),
('assist_10', '마에스트로', '통산 10도움 달성', 'ASSIST', 10),
('rank_1', '첫 우승', '1등 달성', 'PLACEMENT', 1),
('rank_top3', '포디움', '3등 이내 달성', 'PLACEMENT', 3),
('attendance_5', '성실맨', '경기 참여 5회 달성', 'ATTENDANCE', 5),
('attendance_10', '개근상', '경기 참여 10회 달성', 'ATTENDANCE', 10);
