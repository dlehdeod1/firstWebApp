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
    points: number
}

// Helper to calculate all stats
const calculateRankings = async (DB: D1Database) => {
    // 1. Fetch Basic Data
    const playersAttr = await DB.prepare('SELECT id, name FROM players').all<{ id: number, name: string }>()
    const players = playersAttr.results || []

    const statsAttr = await DB.prepare('SELECT player_id, SUM(goals) as goals, SUM(assists) as assists FROM player_match_stats GROUP BY player_id').all<{ player_id: number, goals: number, assists: number }>()

    const membersAttr = await DB.prepare('SELECT session_id, team_id, player_id FROM team_members').all<{ session_id: number, team_id: number, player_id: number }>()

    // session_id + team_id is distinct enough? Yes, team_id is unique per session usually, but let's be safe.
    // Actually team_id is auto-inc PK in teams table? Yes. So team_id matches are globally unique references to teams table.
    // Wait, let's verify Schema. `teams` table has `id`. `team_members` has `team_id`.
    // `matches` has `team1_id`, `team2_id`.
    // So `team_id` is sufficient key.

    const matchesAttr = await DB.prepare('SELECT team1_id, team2_id FROM matches').all<{ team1_id: number, team2_id: number }>()

    // 2. Data Structures
    const playerMap: Record<number, PlayerStats> = {}
    players.forEach(p => {
        playerMap[p.id] = {
            id: p.id,
            name: p.name,
            goals: 0,
            assists: 0,
            games: 0,
            points: 0
        }
    })

    // 3. Fill Goals/Assists
    statsAttr.results?.forEach(s => {
        if (playerMap[s.player_id]) {
            playerMap[s.player_id].goals = s.goals
            playerMap[s.player_id].assists = s.assists
            playerMap[s.player_id].points = s.goals + s.assists
        }
    })

    // 4. Calculate Games Played
    // Map: TeamID -> [PlayerIDs]
    const teamMembers: Record<number, number[]> = {}
    membersAttr.results?.forEach(m => {
        if (!teamMembers[m.team_id]) teamMembers[m.team_id] = []
        teamMembers[m.team_id].push(m.player_id)
    })

    matchesAttr.results?.forEach(m => {
        // Team 1 Players
        if (teamMembers[m.team1_id]) {
            teamMembers[m.team1_id].forEach(pid => {
                if (playerMap[pid]) playerMap[pid].games++
            })
        }
        // Team 2 Players
        if (teamMembers[m.team2_id]) {
            teamMembers[m.team2_id].forEach(pid => {
                if (playerMap[pid]) playerMap[pid].games++
            })
        }
    })

    return Object.values(playerMap)
}

rankings.get('/:type', async (c) => {
    const type = c.req.param('type') as 'goals' | 'assists' | 'points'

    if (!['goals', 'assists', 'points'].includes(type)) {
        return c.json({ error: 'Invalid ranking type' }, 400)
    }

    try {
        const allStats = await calculateRankings(c.env.DB)

        // Sort
        // 1. Metric Desc
        // 2. Games Asc (Eficiency)
        // 3. Name Asc
        allStats.sort((a, b) => {
            const valA = a[type]
            const valB = b[type]

            if (valA !== valB) return valB - valA // Desc
            if (a.games !== b.games) return a.games - b.games // Asc
            return a.name.localeCompare(b.name) // Asc
        })

        // Slice Top 10
        const top10 = allStats.slice(0, 10).map((p, index) => ({
            ...p,
            rank: index + 1 // Add implicit rank
        }))

        return c.json(top10)

    } catch (e) {
        console.error(e)
        return c.json({ error: 'Failed to fetch rankings' }, 500)
    }
})

export default rankings
