-- Badges v1 Seed

-- Clean existing (optional, but good for dev)
DELETE FROM badges;

INSERT INTO badges (code, name, description, condition_type, threshold) VALUES
('first_goal', '첫 득점', '개인 통산 첫 득점 달성', 'GOAL', 1),
('goal_5', '득점 기계', '통산 5골 달성', 'GOAL', 5),
('goal_10', '골 폭격기', '통산 10골 달성', 'GOAL', 10),

('assist_5', '특급 도우미', '통산 5도움 달성', 'ASSIST_CUMULATIVE', 5),
('assist_10', '마에스트로', '통산 10도움 달성', 'ASSIST_CUMULATIVE', 10),

('rank_1', '최고의 공격수', '공격포인트 랭킹 1위 달성', 'RANKING', 1),
('rank_top3', '탑 클래스', '공격포인트 랭킹 TOP 3 진입', 'RANKING', 3),

('attendance_5', '성실한 멤버', '경기 출석 5회 달성', 'ATTENDANCE', 5),
('attendance_10', '개근상', '경기 출석 10회 달성', 'ATTENDANCE', 10);
