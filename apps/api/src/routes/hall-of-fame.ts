import { Hono } from 'hono'
import { D1Database } from '@cloudflare/workers-types'

type Bindings = {
    DB: D1Database
}

const hallOfFame = new Hono<{ Bindings: Bindings }>()

interface SeasonChampion {
    category: string
    categoryLabel: string
    icon: string
    playerId: number
    playerName: string
    value: number
    season: number
}

// Determine season from date (year-based: Jan-Dec = that year's season)
const getSeason = (date: Date): number => {
    return date.getFullYear()
}

// GET /hall-of-fame - Returns current/previous season champions
hallOfFame.get('/', async (c) => {
    const currentSeason = getSeason(new Date())

    try {
        // Categories to rank
        const categories = [
            { key: 'goals', label: '득점왕', icon: '⚽' },
            { key: 'assists', label: '도움왕', icon: '🅰️' },
            { key: 'points', label: '공격포인트왕', icon: '🔥' },
            { key: 'attendance', label: '출석왕', icon: '🏃' },
        ]

        const champions: SeasonChampion[] = []

        // For current season (26 = 2026), show current leaders
        // For previous seasons, show final champions

        // Get all players with stats
        const playersRes = await c.env.DB.prepare('SELECT id, name FROM players').all<{ id: number, name: string }>()
        const players = playersRes.results || []

        // Create player map
        const playerMap: Record<number, { name: string, goals: number, assists: number, points: number, attendance: number }> = {}
        players.forEach(p => {
            playerMap[p.id] = { name: p.name, goals: 0, assists: 0, points: 0, attendance: 0 }
        })

        // Get goals/assists stats
        const statsRes = await c.env.DB.prepare(`
            SELECT player_id, SUM(goals) as goals, SUM(assists) as assists 
            FROM player_match_stats 
            GROUP BY player_id
        `).all<{ player_id: number, goals: number, assists: number }>()

        statsRes.results?.forEach(s => {
            if (playerMap[s.player_id]) {
                playerMap[s.player_id].goals = s.goals
                playerMap[s.player_id].assists = s.assists
                playerMap[s.player_id].points = s.goals + s.assists
            }
        })

        // Get attendance stats
        const attendanceRes = await c.env.DB.prepare(`
            SELECT player_id, COUNT(*) as count 
            FROM attendance 
            GROUP BY player_id
        `).all<{ player_id: number, count: number }>()

        attendanceRes.results?.forEach(a => {
            if (playerMap[a.player_id]) {
                playerMap[a.player_id].attendance = a.count
            }
        })

        // Find top player for each category
        for (const cat of categories) {
            let topPlayer: { id: number, name: string, value: number } | null = null

            for (const [idStr, stats] of Object.entries(playerMap)) {
                const id = Number(idStr)
                const value = stats[cat.key as keyof typeof stats] as number

                if (!topPlayer || value > topPlayer.value) {
                    topPlayer = { id, name: stats.name, value }
                }
            }

            if (topPlayer && topPlayer.value > 0) {
                champions.push({
                    category: cat.key,
                    categoryLabel: cat.label,
                    icon: cat.icon,
                    playerId: topPlayer.id,
                    playerName: topPlayer.name,
                    value: topPlayer.value,
                    season: currentSeason
                })
            }
        }

        return c.json({
            season: currentSeason,
            isCurrentSeason: true,
            champions
        })

    } catch (e) {
        console.error(e)
        return c.json({ error: 'Failed to fetch hall of fame' }, 500)
    }
})

export default hallOfFame
