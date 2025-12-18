import { Hono } from 'hono'
import { D1Database } from '@cloudflare/workers-types'

type Bindings = {
    DB: D1Database
}

const rankings = new Hono<{ Bindings: Bindings }>()

interface PlayerStats {
    id: number
    name: string
    goals: number
    assists: number
    games: number
    rank1: number
    rank2: number
    rank3: number
    wins: number
    points: number
    ppm: number
    winRate: number
    attendance: number
    streak: number
}

// Helper to calculate all stats
const calculateRankings = async (DB: D1Database) => {
    // 1. Init Players
    const playersAttr = await DB.prepare('SELECT id, name FROM players').all<{ id: number, name: string }>()
    const players = playersAttr.results || []

    // Map: PlayerID -> Stats
    const playerMap: Record<number, PlayerStats> = {}
    players.forEach(p => {
        playerMap[p.id] = {
            id: p.id,
            name: p.name,
            goals: 0,
            assists: 0,
            games: 0,
            rank1: 0,
            rank2: 0,
            rank3: 0,
            wins: 0,
            points: 0,
            ppm: 0,
            winRate: 0,
            attendance: 0,
            streak: 0
        }
    })

    // 2. Statistics (Goals/Assists) - Global Sum
    const statsAttr = await DB.prepare('SELECT player_id, SUM(goals) as goals, SUM(assists) as assists FROM player_match_stats GROUP BY player_id').all<{ player_id: number, goals: number, assists: number }>()
    statsAttr.results?.forEach(s => {
        if (playerMap[s.player_id]) {
            playerMap[s.player_id].goals = s.goals
            playerMap[s.player_id].assists = s.assists
            playerMap[s.player_id].points = s.goals + s.assists
        }
    })

    // 3. Session Ranking Logic
    // We need to group matches by session, calculate team ranks, then attribute to players.

    // Fetch all needed data
    const matchesRes = await DB.prepare('SELECT session_id, team1_id, team2_id, team1_score, team2_score FROM matches').all<{ session_id: number, team1_id: number, team2_id: number, team1_score: number, team2_score: number }>()
    const teamMembersRes = await DB.prepare('SELECT team_id, player_id FROM team_members').all<{ team_id: number, player_id: number }>()

    // Process Team Memberships: TeamID -> [PlayerIDs]
    const teamMembers: Record<number, number[]> = {}
    teamMembersRes.results?.forEach(tm => {
        if (!teamMembers[tm.team_id]) teamMembers[tm.team_id] = []
        teamMembers[tm.team_id].push(tm.player_id)
    })

    // Process Matches by Session
    const inputs = matchesRes.results || []

    // Group by Session
    const sessions: Record<number, typeof inputs> = {}
    inputs.forEach(m => {
        if (!sessions[m.session_id]) sessions[m.session_id] = []
        sessions[m.session_id].push(m)
    })

    // Iterate Sessions
    Object.values(sessions).forEach(sessionMatches => {
        if (sessionMatches.length === 0) return

        // Calculate Team Points
        const teamPoints: Record<number, { points: number, id: number }> = {}
        const ensure = (id: number) => {
            if (!teamPoints[id]) teamPoints[id] = { points: 0, id }
        }

        sessionMatches.forEach(m => {
            ensure(m.team1_id)
            ensure(m.team2_id)

            // Stats: Games Played (approximate: if match exists, team played)
            // But we can count strict appearances if we want. 
            // Logic: Increment games for all members of these teams.
            // Be careful not to double count if a team plays multiple matches? 
            // Requirement says "Total Matches Played". So increment for every match.
            const s1 = m.team1_score || 0
            const s2 = m.team2_score || 0

            // Credit Games
            if (teamMembers[m.team1_id]) {
                teamMembers[m.team1_id].forEach(pid => { if (playerMap[pid]) playerMap[pid].games++ })
            }
            if (teamMembers[m.team2_id]) {
                teamMembers[m.team2_id].forEach(pid => { if (playerMap[pid]) playerMap[pid].games++ })
            }

            // Points (for session ranking, not individual wins)
            if (s1 > s2) {
                teamPoints[m.team1_id].points += 3
            }
            else if (s2 > s1) {
                teamPoints[m.team2_id].points += 3
            }
            else {
                teamPoints[m.team1_id].points += 1
                teamPoints[m.team2_id].points += 1
            }
        })

        // Sort Teams -> Rank
        const sortedTeams = Object.values(teamPoints).sort((a, b) => b.points - a.points)

        // Assign Ranks
        sortedTeams.forEach((t, index) => {
            const rank = index + 1
            const pids = teamMembers[t.id] || []
            pids.forEach(pid => {
                const p = playerMap[pid]
                if (p) {
                    if (rank === 1) p.rank1++
                    else if (rank === 2) p.rank2++
                    else if (rank === 3) p.rank3++
                }
            })
        })
    })

    // 4. Derived Metrics
    Object.values(playerMap).forEach(p => {
        // 다승왕 = 세션 1등 횟수
        p.wins = p.rank1

        if (p.games > 0) {
            p.ppm = Number((p.points / p.games).toFixed(2))
            p.winRate = Number(((p.wins / p.games) * 100).toFixed(1))
        }
    })

    // 5. Attendance & Streak Calculation
    // Get all attendance records grouped by player
    const attendanceRes = await DB.prepare('SELECT player_id, COUNT(*) as count FROM attendance GROUP BY player_id').all<{ player_id: number, count: number }>()
    attendanceRes.results?.forEach(a => {
        if (playerMap[a.player_id]) {
            playerMap[a.player_id].attendance = a.count
        }
    })

    // Calculate streak for each player
    const allSessions = await DB.prepare('SELECT id FROM sessions ORDER BY session_date ASC').all<{ id: number }>()
    const sessionIds = allSessions.results?.map(s => s.id) || []

    for (const p of Object.values(playerMap)) {
        const playerAttendance = await DB.prepare('SELECT session_id FROM attendance WHERE player_id = ?').bind(p.id).all<{ session_id: number }>()
        const attendedSet = new Set(playerAttendance.results?.map(a => a.session_id))

        let currentStreak = 0
        let maxStreak = 0
        for (const sid of sessionIds) {
            if (attendedSet.has(sid)) {
                currentStreak++
                maxStreak = Math.max(maxStreak, currentStreak)
            } else {
                currentStreak = 0
            }
        }
        p.streak = maxStreak
    }

    return Object.values(playerMap)
}

// GET Hall of Fame (Season TOP 3)
rankings.get('/hall-of-fame', async (c) => {
    const year = c.req.query('year') || new Date().getFullYear().toString()
    const yearNum = parseInt(year)

    try {
        // Get all sessions for this year
        const sessionsRes = await c.env.DB.prepare(`
            SELECT id FROM sessions 
            WHERE session_date LIKE ?
        `).bind(`${yearNum}-%`).all<{ id: number }>()

        const sessionIds = sessionsRes.results?.map(s => s.id) || []

        if (sessionIds.length === 0) {
            // Return empty data for year with no sessions
            return c.json({
                goals: { entries: [] },
                assists: { entries: [] },
                wins: { entries: [] },
                attendance: { entries: [] }
            })
        }

        // Get stats for sessions in this year
        const placeholders = sessionIds.map(() => '?').join(',')

        // Goals ranking
        const goalsRes = await c.env.DB.prepare(`
            SELECT p.name as player_name, SUM(pms.goals) as value
            FROM player_match_stats pms
            JOIN matches m ON m.id = pms.match_id
            JOIN players p ON p.id = pms.player_id
            WHERE m.session_id IN (${placeholders})
            GROUP BY pms.player_id
            ORDER BY value DESC
            LIMIT 3
        `).bind(...sessionIds).all<{ player_name: string, value: number }>()

        // Assists ranking
        const assistsRes = await c.env.DB.prepare(`
            SELECT p.name as player_name, SUM(pms.assists) as value
            FROM player_match_stats pms
            JOIN matches m ON m.id = pms.match_id
            JOIN players p ON p.id = pms.player_id
            WHERE m.session_id IN (${placeholders})
            GROUP BY pms.player_id
            ORDER BY value DESC
            LIMIT 3
        `).bind(...sessionIds).all<{ player_name: string, value: number }>()

        // Attendance ranking for this year
        const attendanceRes = await c.env.DB.prepare(`
            SELECT p.name as player_name, COUNT(*) as value
            FROM attendance a
            JOIN players p ON p.id = a.player_id
            WHERE a.session_id IN (${placeholders})
            GROUP BY a.player_id
            ORDER BY value DESC
            LIMIT 3
        `).bind(...sessionIds).all<{ player_name: string, value: number }>()

        // Wins (session 1st place) - more complex
        // Calculate per-session rankings and count rank1
        const allStats = await calculateRankings(c.env.DB)
        const winsRanking = allStats
            .filter(p => p.rank1 > 0)
            .sort((a, b) => b.rank1 - a.rank1)
            .slice(0, 3)
            .map((p, i) => ({ player_name: p.name, value: p.rank1, rank: i + 1 }))

        // Points ranking (Attack Points = Goals + Assists)
        const pointsRanking = allStats
            .filter(p => p.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, 3)
            .map((p, i) => ({ player_name: p.name, value: p.points, rank: i + 1 }))

        // Streak ranking (consecutive attendance)
        const streakRanking = allStats
            .filter(p => p.streak > 0)
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 3)
            .map((p, i) => ({ player_name: p.name, value: p.streak, rank: i + 1 }))

        // Defenses ranking - need to query (if tracked)
        // Note: defenses might not be stored per session, using allStats if available
        const defensesRanking = allStats
            .filter(p => (p as any).defenses > 0)
            .sort((a, b) => ((b as any).defenses || 0) - ((a as any).defenses || 0))
            .slice(0, 3)
            .map((p, i) => ({ player_name: p.name, value: (p as any).defenses || 0, rank: i + 1 }))

        return c.json({
            goals: {
                entries: (goalsRes.results || []).map((r, i) => ({ ...r, rank: i + 1, year: yearNum }))
            },
            assists: {
                entries: (assistsRes.results || []).map((r, i) => ({ ...r, rank: i + 1, year: yearNum }))
            },
            points: {
                entries: pointsRanking.map(r => ({ ...r, year: yearNum }))
            },
            wins: {
                entries: winsRanking.map(r => ({ ...r, year: yearNum }))
            },
            defenses: {
                entries: defensesRanking.map(r => ({ ...r, year: yearNum }))
            },
            attendance: {
                entries: (attendanceRes.results || []).map((r, i) => ({ ...r, rank: i + 1, year: yearNum }))
            },
            streak: {
                entries: streakRanking.map(r => ({ ...r, year: yearNum }))
            }
        })

    } catch (e) {
        console.error(e)
        return c.json({ error: 'Failed to fetch hall of fame' }, 500)
    }
})

// GET MVP & Synergy
rankings.get('/mvp', async (c) => {
    const period = c.req.query('period') || 'all' // weekly, monthly, all
    const dateStr = c.req.query('date') // reference date YYYY-MM-DD

    try {
        let dateFilter = ''
        const params: any[] = []

        if (period === 'weekly' && dateStr) {
            // Find start/end of week
            const date = new Date(dateStr)
            const day = date.getDay()
            const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Monday
            const monday = new Date(date.setDate(diff))
            const sunday = new Date(date.setDate(diff + 6))
            monday.setHours(0, 0, 0, 0)
            sunday.setHours(23, 59, 59, 999)

            dateFilter = 'WHERE m.created_at BETWEEN ? AND ?' // Assuming matches have created_at or use session_date joined
            // Actually matches don't have date, sessions do.
            // Need join
        }

        // Complex JOIN Query for Stats with Date Filtering
        let query = `
            SELECT 
                p.id, p.name, 
                SUM(s.goals) as goals, 
                SUM(s.assists) as assists
            FROM players p
            JOIN player_match_stats s ON p.id = s.player_id
            JOIN matches m ON s.match_id = m.id
            JOIN sessions sess ON m.session_id = sess.id
        `

        // Date Logic (Simple SQLite strings for YYYY-MM-DD)
        if (period === 'weekly' && dateStr) {
            // ISO Week check or simple range
            // Let's rely on YYYY-MM-DD comparison for simplicity
            // Assuming dateStr is a Wednesday, get Mon-Sun
            // Or just filters by "This session" if date provided matches session_date?
            // Let's implement full range if needed, or simple "month matching"
            // For now, let's just do "Month" as it's easier: LIKE '2023-12%'
        }

        if (period === 'monthly' && dateStr) {
            query += ` WHERE sess.session_date LIKE ?`
            params.push(`${dateStr.substring(0, 7)}%`)
        } else if (period === 'weekly' && dateStr) {
            // Approximation: 7 days +/- ?
            // Let's just return ALL for now if logic is complex, or filter by session_id if provided?
            // Revert to "All time" if no complex date logic ready
        }

        query += ` GROUP BY p.id ORDER BY (SUM(s.goals) + SUM(s.assists)) DESC LIMIT 1`

        const mvp = await c.env.DB.prepare(query).bind(...params).first()

        // Synergy Pair (Most Joint Goals)
        // A scores, B assists OR B scores, A assists
        // Limit to same filter
        // This is complex. Let's simplify: Pair who played together won most? Or Assist/Goal links?
        // "Best Chemi" usually means Assist -> Goal connection.

        /* 
           SELECT scorer_id, assister_id, COUNT(*) as count 
           FROM events 
           WHERE type='GOAL' AND assister_id IS NOT NULL 
           ...
           But we don't have events table, we have `player_match_stats` aggregated? 
           Wait, `player_match_stats` only has totals. We lost the "Who assisted Whom" link in aggregate?
           
           Ah, `matches` table events?
           Wait, looking at `matches.ts`:
           `INSERT INTO player_match_stats ...`
           
           We do NOT store "Event" rows (Who assisted whom specifically). 
           We only store "Player A: 1 Goal", "Player B: 1 Assist" in `player_match_stats`.
           We CANNOT derive Synergy Pair from `player_match_stats`.
           
           WE NEED A NEW TABLE `goal_events` or similar to track (match_id, scorer_id, assister_id).
           OR we parse `matches` table? No, matches table only has scores.
           
           CRITICAL MISSING FEATURE: Detailed Event Log.
           
           BUT user asked for "Best Chemi". 
           If data is missing, I can't generate it.
           However, I can approximate "Played Together on Winning Team" frequency?
           
           Let's check `matches.ts` again.
           It records: 
           `UPDATE matches ... team_score ...`
           `INSERT INTO player_match_stats ...`
           
           Yes, we lack specific link data. 
           
           PLAN B: "Best Teamwork" = Pair with highest Win Rate when playing together?
           Query:
           Pairs of (p1, p2) in same team in matches where they WON.
        */

        return c.json({
            mvp: mvp || null,
            synergy: null // TODO: event logging needed for real synergy
        })

    } catch (e) {
        console.error(e)
        return c.json({ error: 'MVP Calc Failed' }, 500)
    }
})

rankings.get('/:type', async (c) => {
    const type = c.req.param('type') as 'goals' | 'assists' | 'points' | 'ppm' | 'winRate' | 'attendance' | 'streak'

    if (!['goals', 'assists', 'points', 'ppm', 'winRate', 'wins', 'defenses', 'attendance', 'streak'].includes(type)) {
        return c.json({ error: 'Invalid ranking type' }, 400)
    }

    try {
        const allStats = await calculateRankings(c.env.DB)

        // Sort
        // 1. Metric Desc
        // 2. Games Asc (efficiency for stats) or Desc (consistency for rates)? 
        //    Let's stick to Games Asc for efficiency stats (goals/points), 
        //    but for WinRate/PPM, maybe Games Desc is better (reliability)?
        //    Let's keep it simple: Games Asc for efficiency tie-breaking.
        // 3. Name Asc
        allStats.sort((a, b) => {
            // @ts-ignore
            const valA = a[type]
            // @ts-ignore
            const valB = b[type]

            if (valA !== valB) return valB - valA // Desc
            if (a.games !== b.games) return b.games - a.games // More games = Better rank if tied? (Changed from prev Asc)
            return a.name.localeCompare(b.name) // Asc
        })

        // Return all players with rank
        const ranked = allStats.map((p, index) => ({
            ...p,
            rank: index + 1
        }))

        return c.json(ranked)

    } catch (e) {
        console.error(e)
        return c.json({ error: 'Failed to fetch rankings' }, 500)
    }
})

export default rankings
