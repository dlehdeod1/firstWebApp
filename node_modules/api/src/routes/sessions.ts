import { Hono } from 'hono'
import { parseSessionText } from '../utils/parser'
import { TeamBalancer, PlayerStats } from '../utils/teamGenerator'

type Bindings = {
    DB: D1Database
}

const sessions = new Hono<{ Bindings: Bindings }>()

sessions.post('/parse', async (c) => {
    const body = await c.req.json<{ text: string }>()
    const result = parseSessionText(body.text)

    // Try to match player names from DB
    const { results } = await c.env.DB.prepare(
        'SELECT * FROM players'
    ).all<PlayerStats>()

    const players = results || []

    const matched: any[] = []
    const unknown: string[] = []

    result.names.forEach(name => {
        // Exact match or alias match
        // Simplified: exact match on name
        const found = players.find(p => p.name === name) // TODO: Check aliases
        if (found) {
            matched.push(found)
        } else {
            unknown.push(name)
        }
    })

    return c.json({
        date: result.date,
        matched,
        unknown,
        count: result.names.length
    })
})

sessions.post('/', async (c) => {
    const { date, title, pot_total, base_fee, player_ids } = await c.req.json()

    // Transaction?
    // 1. Create Session
    const res = await c.env.DB.prepare(
        'INSERT INTO sessions (session_date, title, pot_total, base_fee) VALUES (?, ?, ?, ?) RETURNING id'
    ).bind(date, title, pot_total, base_fee).first()

    const sessionId = res?.id as number

    // 2. Add Attendance
    if (player_ids && Array.isArray(player_ids)) {
        const stmt = c.env.DB.prepare('INSERT INTO attendance (session_id, player_id) VALUES (?, ?)')
        await c.env.DB.batch(player_ids.map((pid: number) => stmt.bind(sessionId, pid)))
    }

    return c.json({ id: sessionId, success: true })
})

sessions.post('/:id/teams/generate', async (c) => {
    try {
        const sessionId = c.req.param('id')
        const { numTeams } = await c.req.json()

        // 1. Fetch attendees
        const { results: players } = await c.env.DB.prepare(`
            SELECT p.* FROM players p
            JOIN attendance a ON p.id = a.player_id
            WHERE a.session_id = ?
        `).bind(sessionId).all<PlayerStats>()

        if (!players || players.length === 0) {
            return c.json({ error: 'No players found for this session' }, 400)
        }

        // 2. Fetch Chemistry
        const { results: chemistry } = await c.env.DB.prepare('SELECT * FROM chemistry_edges').all()

        // 3. Generate Teams
        const balancer = new TeamBalancer(players, chemistry as any[])
        const result = balancer.generate(numTeams || 3)

        // Custom Naming Logic: Oldest Member
        const namedTeams = result.teams.map((team: any, index: number) => {
            let name = `Team ${String.fromCharCode(65 + index)}`
            if (team.players.length > 0) {
                // Sort by join_date (asc), then name (asc)
                // Use specific date parsing or simple string check
                const sorted = [...team.players].sort((a: any, b: any) => {
                    const dA = a.join_date ? new Date(a.join_date).getTime() : 9999999999999
                    const dB = b.join_date ? new Date(b.join_date).getTime() : 9999999999999
                    if (Number.isNaN(dA)) return 1 // Handle invalid date
                    if (Number.isNaN(dB)) return -1
                    if (dA !== dB) return dA - dB
                    return a.name.localeCompare(b.name)
                })
                if (sorted.length > 0) {
                    name = `${sorted[0].name}팀`
                }
            }
            return { ...team, name }
        })

        // 4. Save to DB (Transaction-like)
        // Clear existing teams/matches first (Overwrite)
        // Dependent records must be deleted first to avoid FK violations
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId),
            c.env.DB.prepare('DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE session_id = ?)').bind(sessionId),
            c.env.DB.prepare('DELETE FROM teams WHERE session_id = ?').bind(sessionId)
        ])

        // Insert Teams and Members
        const teamIds: number[] = []
        for (const team of namedTeams) {
            const res = await c.env.DB.prepare('INSERT INTO teams (session_id, name) VALUES (?, ?) RETURNING id')
                .bind(sessionId, team.name)
                .first()
            if (res && res.id) {
                const teamId = res.id as number
                teamIds.push(teamId)

                if (team.players.length > 0) {
                    const stmt = c.env.DB.prepare('INSERT INTO team_members (team_id, player_id) VALUES (?, ?)')
                    const batch = team.players.map((p: any) => stmt.bind(teamId, p.id))
                    await c.env.DB.batch(batch)
                }
            }
        }

        // 5. Generate Matches (9 Matches for 3 teams: AB, BC, CA x 3)
        const matches = []
        if (teamIds.length === 3) {
            const [a, b, c] = teamIds
            // Cycle: A-B, B-C, C-A
            const cycle = [
                { t1: a, t2: b },
                { t1: b, t2: c },
                { t1: c, t2: a }
            ]
            // 9 Matches
            for (let i = 0; i < 3; i++) {
                matches.push(...cycle)
            }
        } else if (teamIds.length === 2) {
            const [a, b] = teamIds
            for (let i = 0; i < 5; i++) matches.push({ t1: a, t2: b })
        }

        if (matches.length > 0) {
            const stmt = c.env.DB.prepare('INSERT INTO matches (session_id, team1_id, team2_id, match_no) VALUES (?, ?, ?, ?)')
            await c.env.DB.batch(matches.map((m, idx) => stmt.bind(sessionId, m.t1, m.t2, idx + 1)))
        }

        return c.json({ success: true, teams: namedTeams, match_count: matches.length })
    } catch (e: any) {
        console.error('GENERATE ERROR:', e)
        return c.json({ error: e.message, stack: e.stack }, 500)
    }
})

sessions.post('/:id/teams/assign', async (c) => {
    const sessionId = c.req.param('id')
    const { playerId, teamId } = await c.req.json()

    // 1. Remove from any existing team in this session
    // Find all teams in this session
    const { results: teams } = await c.env.DB.prepare('SELECT id FROM teams WHERE session_id = ?').bind(sessionId).all<{ id: number }>()
    if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id).join(',')
        // Delete membership where team_id in session's teams AND player_id = ?
        await c.env.DB.prepare(`DELETE FROM team_members WHERE team_id IN (${teamIds}) AND player_id = ?`).bind(playerId).run()
    }

    // 2. Add to new team (if teamId provided)
    if (teamId) {
        await c.env.DB.prepare('INSERT INTO team_members (team_id, player_id) VALUES (?, ?)').bind(teamId, playerId).run()
    }

    return c.json({ success: true })
})

// GET Session Detail
sessions.get('/:id', async (c) => {
    const id = c.req.param('id')
    const session = await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first()

    if (!session) return c.json({ error: 'Not found' }, 404)

    // Attendees
    const { results: players } = await c.env.DB.prepare(`
        SELECT p.* FROM players p
        JOIN attendance a ON p.id = a.player_id
        WHERE a.session_id = ?
    `).bind(id).all()

    // Teams
    const { results: teams } = await c.env.DB.prepare('SELECT * FROM teams WHERE session_id = ?').bind(id).all<any>()

    // Team Members
    const { results: teamMembers } = await c.env.DB.prepare(`
        SELECT tm.team_id, p.id, p.name 
        FROM team_members tm
        JOIN players p ON tm.player_id = p.id
        WHERE tm.team_id IN (SELECT id FROM teams WHERE session_id = ?)
    `).bind(id).all<any>()

    // Attach members to teams
    const teamsWithMembers = teams?.map(team => ({
        ...team,
        players: teamMembers?.filter(m => m.team_id === team.id) || []
    }))

    // Matches
    const { results: matches } = await c.env.DB.prepare('SELECT * FROM matches WHERE session_id = ?').bind(id).all()

    return c.json({
        ...session,
        players: players || [],
        teams: teamsWithMembers || [],
        matches: matches || []
    })
})

// PUT Status
sessions.put('/:id/status', async (c) => {
    const id = c.req.param('id')
    const { status } = await c.req.json()
    await c.env.DB.prepare('UPDATE sessions SET status = ? WHERE id = ?').bind(status, id).run()

    if (status === 'closed') {
        const { AbilityService } = await import('../services/AbilityService')
        await AbilityService.calculateSessionStats(c.env.DB, id)
    }

    return c.json({ success: true, status })
})

// PUT Attendance (Overwrite)
sessions.put('/:id/attendance', async (c) => {
    const id = c.req.param('id')
    const { player_ids } = await c.req.json()

    // Transaction
    const batch = [
        c.env.DB.prepare('DELETE FROM attendance WHERE session_id = ?').bind(id)
    ]

    if (player_ids && player_ids.length > 0) {
        const stmt = c.env.DB.prepare('INSERT INTO attendance (session_id, player_id) VALUES (?, ?)')
        player_ids.forEach((pid: any) => batch.push(stmt.bind(id, pid)))
    }

    await c.env.DB.batch(batch)
    return c.json({ success: true })
})

// Clear Matches
sessions.delete('/:id/matches', async (c) => {
    const sessionId = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId).run()
    return c.json({ success: true })
})

// Regen Matches (Rotation)
sessions.post('/:id/matches/generate', async (c) => {
    const sessionId = c.req.param('id')
    const { results: teams } = await c.env.DB.prepare('SELECT id FROM teams WHERE session_id = ? ORDER BY id').bind(sessionId).all<{ id: number }>()
    if (!teams || teams.length < 2) return c.json({ error: 'Not enough teams' }, 400)

    await c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId).run()

    const matches = []
    if (teams.length === 3) {
        const [a, b, c] = teams.map(t => t.id)
        const cycle = [{ t1: a, t2: b }, { t1: b, t2: c }, { t1: c, t2: a }]
        for (let i = 0; i < 3; i++) matches.push(...cycle)
    } else if (teams.length === 2) {
        const [a, b] = teams.map(t => t.id)
        for (let i = 0; i < 5; i++) matches.push({ t1: a, t2: b })
    } else {
        // Generic Round Robin
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                matches.push({ t1: teams[i].id, t2: teams[j].id })
            }
        }
    }

    if (matches.length > 0) {
        const stmt = c.env.DB.prepare('INSERT INTO matches (session_id, team1_id, team2_id, match_no) VALUES (?, ?, ?, ?)')
        await c.env.DB.batch(matches.map((m, idx) => stmt.bind(sessionId, m.t1, m.t2, idx + 1)))
    }
    return c.json({ success: true, count: matches.length })
})

// Auto-Fill Matches (Rotation)
sessions.post('/:id/matches/autofill', async (c) => {
    const sessionId = c.req.param('id')
    const { results: teams } = await c.env.DB.prepare('SELECT id FROM teams WHERE session_id = ? ORDER BY id').bind(sessionId).all<{ id: number }>()
    if (!teams || teams.length < 2) return c.json({ error: 'Not enough teams' }, 400)

    // Get existing matches
    const { results: existing } = await c.env.DB.prepare('SELECT * FROM matches WHERE session_id = ?').bind(sessionId).all()
    const count = existing ? existing.length : 0
    const target = 9 // Default target 9 for 3 teams

    if (count >= target) return c.json({ message: 'Already enough matches' })

    const newMatches = []
    const teamIds = teams.map(t => t.id)

    // Determine cycle based on team count
    let cycle: { t1: number, t2: number }[] = []
    if (teamIds.length === 3) {
        const [a, b, c] = teamIds
        cycle = [{ t1: a, t2: b }, { t1: b, t2: c }, { t1: c, t2: a }]
    } else if (teamIds.length === 2) {
        cycle = [{ t1: teamIds[0], t2: teamIds[1] }]
    }

    if (cycle.length > 0) {
        for (let i = count; i < target; i++) {
            const pick = cycle[i % cycle.length]
            newMatches.push({ ...pick, match_no: i + 1 })
        }
    }

    if (newMatches.length > 0) {
        const stmt = c.env.DB.prepare('INSERT INTO matches (session_id, team1_id, team2_id, match_no) VALUES (?, ?, ?, ?)')
        await c.env.DB.batch(newMatches.map(m => stmt.bind(sessionId, m.t1, m.t2, m.match_no)))
    }

    return c.json({ success: true, added: newMatches.length })
})

export default sessions
