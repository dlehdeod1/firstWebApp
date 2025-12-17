import { D1Database } from '@cloudflare/workers-types'

export class BadgeService {
    static async checkBadges(DB: D1Database, userId: string) {
        // 1. Get Player ID
        const player = await DB.prepare('SELECT id FROM players WHERE user_id = ?').bind(userId).first()
        if (!player) return null
        const playerId = player.id as number

        // 2. Get Stats
        const stats = await this.getStatsByPlayerId(DB, playerId)
        if (!stats) return null

        // 3. Get Ranking Info (SQL-based for efficiency)
        // Count players with strictly more points
        const betterPlayers = await DB.prepare(`
            SELECT COUNT(*) as count 
            FROM (
                SELECT SUM(goals) + SUM(assists) as points 
                FROM player_match_stats 
                GROUP BY player_id
            ) 
            WHERE points > ?
        `).bind(stats.attackPoints).first<{ count: number }>()

        const myRank = (betterPlayers?.count || 0) + 1

        // Define Checks
        const checks = [
            // Goal
            { code: 'first_goal', check: () => stats.goals >= 1 },
            { code: 'goal_5', check: () => stats.goals >= 5 },
            { code: 'goal_10', check: () => stats.goals >= 10 },

            // Assist
            { code: 'assist_5', check: () => stats.assists >= 5 },
            { code: 'assist_10', check: () => stats.assists >= 10 },

            // Ranking
            { code: 'rank_1', check: () => myRank === 1 && stats.attackPoints > 0 }, // Must have points
            { code: 'rank_top3', check: () => myRank <= 3 && stats.attackPoints > 0 },

            // Attendance (경기 참여 = Matches Played)
            { code: 'attendance_5', check: () => stats.matchesPlayed >= 5 },
            { code: 'attendance_10', check: () => stats.matchesPlayed >= 10 },
        ]

        // Grant Badges
        const earnedChecks = checks.filter(c => c.check())
        const codes = earnedChecks.map(c => c.code)

        // Insert Ignore to avoid duplicates
        if (codes.length > 0) {
            const placeholders = codes.map(() => '(?, ?, unixepoch())').join(', ')
            const values = codes.flatMap(code => [playerId, code])

            // SQLite INSERT OR IGNORE INTO player_badges
            await DB.prepare(`INSERT OR IGNORE INTO player_badges (player_id, badge_code, earned_at) VALUES ${placeholders}`)
                .bind(...values)
                .run()
        }

        // Return current state
        const badges = await DB.prepare(`
            SELECT b.*, pb.earned_at as awarded_at 
            FROM badges b 
            JOIN player_badges pb ON b.code = pb.badge_code 
            WHERE pb.player_id = ?
        `).bind(playerId).all()

        return {
            records: {
                wins: stats.rank1,
                rank1: stats.rank1,
                rank2: stats.rank2,
                rank3: stats.rank3,
                podiums: stats.rank1 + stats.rank2 + stats.rank3,
                goals: stats.goals,
                assists: stats.assists,
                attackPoints: stats.attackPoints,
                attendance: stats.attendance,
                matchesPlayed: stats.matchesPlayed,
                totalScore: 0
            },
            badges: badges.results || []
        }
    }

    static async getStats(DB: D1Database, userId: string) {
        // 1. Get Player ID
        const player = await DB.prepare('SELECT id FROM players WHERE user_id = ?').bind(userId).first()
        if (!player) return null
        return this.getStatsByPlayerId(DB, player.id as number)
    }

    static async getStatsByPlayerId(DB: D1Database, playerId: number) {
        // 2. Aggregate Match Stats
        const stats = await DB.prepare(`
            SELECT 
                COALESCE(SUM(goals), 0) as total_goals, 
                COALESCE(SUM(assists), 0) as total_assists
            FROM player_match_stats 
            WHERE player_id = ?
        `).bind(playerId).first<{ total_goals: number, total_assists: number }>()

        // 3. Attendance
        const attendance = await DB.prepare(`
            SELECT COUNT(*) as total FROM attendance WHERE player_id = ?
        `).bind(playerId).first<{ total: number }>()

        // 4. Wins & Ranks
        const sessions = await DB.prepare('SELECT session_id FROM attendance WHERE player_id = ?').bind(playerId).all<{ session_id: number }>()

        // 4.1 Batch fetch matches for these sessions? 
        // Or fetch ALL matches and process in memory (easiest for small dataset, D1 is fast locally)
        // Optimization: Fetch matches only for attended sessions.
        // But for each session we need all matches to rank teams.

        let rank1 = 0
        let rank2 = 0
        let rank3 = 0
        let matchesPlayed = 0

        // We iterate sessions to calculate ranks and match counts
        if (sessions.results) {
            for (const s of sessions.results) {
                const matches = await DB.prepare('SELECT * FROM matches WHERE session_id = ?').bind(s.session_id).all()
                if (!matches.results || matches.results.length === 0) continue

                // Find my team in this session (via teams table since team_members doesn't have session_id)
                const membership = await DB.prepare(`
                    SELECT tm.team_id
                    FROM team_members tm
                    JOIN teams t ON t.id = tm.team_id
                    WHERE t.session_id = ? AND tm.player_id = ?
                `).bind(s.session_id, playerId).first()
                if (!membership) continue
                const myTeamId = membership.team_id as number

                // 1. Count Matches Played
                const sessionMatchesPlayed = matches.results.filter((m: any) => m.team1_id === myTeamId || m.team2_id === myTeamId).length
                matchesPlayed += sessionMatchesPlayed

                // 2. Calculate Rank (existing logic)
                const teamPoints: Record<number, number> = {}
                matches.results.forEach((m: any) => {
                    const s1 = m.team1_score || 0
                    const s2 = m.team2_score || 0
                    if (!teamPoints[m.team1_id]) teamPoints[m.team1_id] = 0
                    if (!teamPoints[m.team2_id]) teamPoints[m.team2_id] = 0

                    if (s1 > s2) teamPoints[m.team1_id] += 3
                    else if (s2 > s1) teamPoints[m.team2_id] += 3
                    else {
                        teamPoints[m.team1_id] += 1
                        teamPoints[m.team2_id] += 1
                    }
                })

                const sorted = Object.entries(teamPoints).sort(([, a], [, b]) => b - a)
                const myRank = sorted.findIndex(([tid]) => Number(tid) === myTeamId) + 1

                if (myRank === 1) rank1++
                else if (myRank === 2) rank2++
                else if (myRank === 3) rank3++
            }
        }

        // Streak Logic
        // Get ALL session IDs sorted by date
        const allSessions = await DB.prepare('SELECT id, session_date FROM sessions ORDER BY session_date ASC').all<{ id: number }>()
        const mySessionIds = new Set(sessions.results?.map(s => s.session_id))

        let streak = 0
        if (allSessions.results) {
            let current = 0
            let maxStreak = 0
            for (const s of allSessions.results) {
                if (mySessionIds.has(s.id)) {
                    current++
                } else {
                    maxStreak = Math.max(maxStreak, current)
                    current = 0
                }
            }
            maxStreak = Math.max(maxStreak, current)
            streak = maxStreak
        }

        const hattricks = await DB.prepare(`
            SELECT COUNT(*) as count FROM player_match_stats WHERE player_id = ? AND goals >= 3
        `).bind(playerId).first<{ count: number }>()

        const totalGoals = stats?.total_goals || 0
        const totalAssists = stats?.total_assists || 0

        return {
            rank1, rank2, rank3,
            goals: totalGoals,
            assists: totalAssists,
            attackPoints: totalGoals + totalAssists,
            attendance: attendance?.total || 0,
            matchesPlayed, // New
            streak,
            hattricks: hattricks?.count || 0
        }
    }
}
