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

        // 2. Fetch Chemistry & Preferences
        const { results: staticChem } = await c.env.DB.prepare('SELECT * FROM chemistry_edges').all<any>()
        const { results: prefs } = await c.env.DB.prepare('SELECT player_id, target_player_id, rank FROM player_preferences').all<any>()

        const chemMap = new Map<string, number>()

        // Static
        staticChem?.forEach(c => {
            const key = [c.player_a_id, c.player_b_id].sort((a, b) => a - b).join('-')
            chemMap.set(key, (chemMap.get(key) || 0) + c.score)
        })

        // Preferences (Rank 1=+5, 2=+3, 3=+1)
        prefs?.forEach(p => {
            const score = p.rank === 1 ? 5 : p.rank === 2 ? 3 : 1
            const key = [p.player_id, p.target_player_id].sort((a: number, b: number) => a - b).join('-')
            chemMap.set(key, (chemMap.get(key) || 0) + score)
        })

        const combinedChemistry = Array.from(chemMap.entries()).map(([key, score]) => {
            const [p1, p2] = key.split('-').map(Number)
            return { player_a_id: p1, player_b_id: p2, score }
        })

        // 3. Generate Teams
        const balancer = new TeamBalancer(players, combinedChemistry)
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
        // Order: player_match_stats -> matches -> team_members -> teams
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM player_match_stats WHERE match_id IN (SELECT id FROM matches WHERE session_id = ?)').bind(sessionId),
            c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId),
            c.env.DB.prepare('DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE session_id = ?)').bind(sessionId),
            c.env.DB.prepare('DELETE FROM teams WHERE session_id = ?').bind(sessionId)
        ])

        // Insert Teams and Members
        const teamIds: number[] = []
        const validPlayerIds = new Set(players.map(p => p.id))

        for (const team of namedTeams) {
            const res = await c.env.DB.prepare('INSERT INTO teams (session_id, name) VALUES (?, ?) RETURNING id')
                .bind(sessionId, team.name)
                .first()
            if (res && res.id) {
                const teamId = res.id as number
                teamIds.push(teamId)

                // Filter to only include valid players that exist in DB
                const validPlayers = team.players.filter((p: any) => validPlayerIds.has(p.id))
                if (validPlayers.length > 0) {
                    const stmt = c.env.DB.prepare('INSERT INTO team_members (team_id, player_id) VALUES (?, ?)')
                    const batch = validPlayers.map((p: any) => stmt.bind(teamId, p.id))
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

        // 6. AI Analysis (optional, don't fail if it errors)
        let aiAnalysis: any[] = []
        try {
            const apiKey = (c.env as any).GEMINI_API_KEY
            if (apiKey && namedTeams.length > 0) {
                // Prepare team data
                const teamData = namedTeams.map((t: any) => {
                    const avgShooting = t.players.length ? Math.round(t.players.reduce((s: number, p: any) => s + (p.shooting || 50), 0) / t.players.length) : 50
                    const avgPassing = t.players.length ? Math.round(t.players.reduce((s: number, p: any) => s + (p.passing || 50), 0) / t.players.length) : 50
                    const avgStamina = t.players.length ? Math.round(t.players.reduce((s: number, p: any) => s + (p.stamina || 50), 0) / t.players.length) : 50
                    const avgSpeed = t.players.length ? Math.round(t.players.reduce((s: number, p: any) => s + (p.speed || 50), 0) / t.players.length) : 50
                    return {
                        teamName: t.name,
                        players: t.players.map((p: any) => p.name),
                        stats: { avgShooting, avgPassing, avgStamina, avgSpeed }
                    }
                })

                const prompt = `당신은 축구 전략 전문가입니다. 아래 팀 구성을 분석하고 각 팀에 맞는 전략을 추천해주세요.

팀 정보:
${teamData.map((t: any, i: number) => `팀${i + 1}. ${t.teamName} - 선수: ${t.players.join(', ')} - 슈팅:${t.stats.avgShooting} 패스:${t.stats.avgPassing} 스태미나:${t.stats.avgStamina} 스피드:${t.stats.avgSpeed}`).join('\n')}

각 팀에 대해 JSON 형식으로 응답: [{"teamName":"팀명","type":"공격형/수비형/점유형/체력형/밸런스형","emoji":"이모지","strategy":"2문장 전략","keyPlayer":"핵심선수","keyPlayerReason":"이유"}]
JSON만 응답.`

                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                    })
                })

                if (geminiRes.ok) {
                    const geminiData = await geminiRes.json() as any
                    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
                    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
                    if (jsonMatch) {
                        aiAnalysis = JSON.parse(jsonMatch[0])

                        // Save AI analysis to each team's score_stats
                        for (let i = 0; i < teamIds.length && i < namedTeams.length; i++) {
                            const teamAnalysis = aiAnalysis.find((a: any) => a.teamName === namedTeams[i].name)
                            if (teamAnalysis) {
                                await c.env.DB.prepare('UPDATE teams SET score_stats = ? WHERE id = ?')
                                    .bind(JSON.stringify(teamAnalysis), teamIds[i])
                                    .run()
                            }
                        }
                    }
                }
            }
        } catch (aiError) {
            console.error('AI Analysis failed (non-critical):', aiError)
        }

        return c.json({
            success: true,
            teams: namedTeams,
            match_count: matches.length,
            balanceScore: result.balanceScore,
            logs: result.logs
        })
    } catch (e: any) {
        console.error('GENERATE ERROR:', e)
        return c.json({ error: e.message, stack: e.stack }, 500)
    }
})

// AI TEAM ANALYSIS using Gemini
sessions.post('/:id/teams/analyze', async (c) => {
    const sessionId = c.req.param('id')

    try {
        // Get teams with players
        const { results: teams } = await c.env.DB.prepare(`
            SELECT t.id, t.name, 
                   GROUP_CONCAT(p.name || '|' || COALESCE(p.shooting,50) || '|' || COALESCE(p.passing,50) || '|' || COALESCE(p.stamina,50) || '|' || COALESCE(p.speed,50)) as players_data
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            LEFT JOIN players p ON tm.player_id = p.id
            WHERE t.session_id = ?
            GROUP BY t.id
        `).bind(sessionId).all<{ id: number, name: string, players_data: string }>()

        if (!teams || teams.length === 0) {
            return c.json({ error: 'No teams found' }, 404)
        }

        // Format team data for prompt
        const teamData = teams.map(t => {
            const players = t.players_data ? t.players_data.split(',').map(pd => {
                const [name, shooting, passing, stamina, speed] = pd.split('|')
                return { name, shooting: +shooting, passing: +passing, stamina: +stamina, speed: +speed }
            }) : []

            const avgShooting = players.length ? Math.round(players.reduce((s, p) => s + p.shooting, 0) / players.length) : 50
            const avgPassing = players.length ? Math.round(players.reduce((s, p) => s + p.passing, 0) / players.length) : 50
            const avgStamina = players.length ? Math.round(players.reduce((s, p) => s + p.stamina, 0) / players.length) : 50
            const avgSpeed = players.length ? Math.round(players.reduce((s, p) => s + p.speed, 0) / players.length) : 50

            return {
                teamName: t.name,
                players: players.map(p => p.name),
                stats: { avgShooting, avgPassing, avgStamina, avgSpeed }
            }
        })

        const prompt = `당신은 축구 전략 전문가입니다. 아래 팀 구성을 분석하고 각 팀에 맞는 전략을 추천해주세요.

팀 정보:
${teamData.map((t, i) => `
팀${i + 1}. ${t.teamName}
- 선수: ${t.players.join(', ')}
- 평균 슈팅: ${t.stats.avgShooting}, 패스: ${t.stats.avgPassing}, 스태미나: ${t.stats.avgStamina}, 스피드: ${t.stats.avgSpeed}
`).join('\n')}

각 팀에 대해 다음 JSON 형식으로 응답해주세요:
[
  {
    "teamName": "팀 이름",
    "type": "공격형/수비형/점유형/체력형/밸런스형 중 하나",
    "emoji": "팀 타입에 맞는 이모지 1개",
    "strategy": "2문장 이내의 구체적인 전략 제안",
    "keyPlayer": "핵심 선수 이름",
    "keyPlayerReason": "핵심 선수 선정 이유 (1문장)"
  }
]

JSON만 응답하세요.`

        // Call Gemini API
        const apiKey = (c.env as any).GEMINI_API_KEY
        if (!apiKey) {
            return c.json({ error: 'Gemini API key not configured' }, 500)
        }

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024
                }
            })
        })

        if (!geminiRes.ok) {
            const err = await geminiRes.text()
            console.error('Gemini API error:', err)
            return c.json({ error: 'AI analysis failed' }, 500)
        }

        const geminiData = await geminiRes.json() as any
        const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Parse JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
            return c.json({ error: 'Failed to parse AI response', raw: responseText }, 500)
        }

        const analysis = JSON.parse(jsonMatch[0])
        return c.json({ success: true, analysis })

    } catch (e: any) {
        console.error('AI ANALYZE ERROR:', e)
        return c.json({ error: e.message }, 500)
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



// GET All Sessions
sessions.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM sessions ORDER BY session_date DESC').all()

        // Count attendees for each session
        // Only if needed for UI "14명 참석"
        // This N+1 is bad, better JOIN or simple aggregation
        const { results: counts } = await c.env.DB.prepare('SELECT session_id, COUNT(*) as count FROM attendance GROUP BY session_id').all<{ session_id: number, count: number }>()
        const countMap = new Map(counts?.map(r => [r.session_id, r.count]))

        const sessions = results?.map(s => ({
            ...s,
            attendance_count: countMap.get(s.id as number) || 0
        })) || []

        return c.json(sessions)
    } catch (e) {
        return c.json({ error: 'Failed to fetch sessions' }, 500)
    }
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

    // Team Members (include stats for power calculation)
    const { results: teamMembers } = await c.env.DB.prepare(`
        SELECT tm.team_id, p.id, p.name, 
               p.shooting, p.passing, p.stamina, p.speed, p.physical,
               p.ball_keeping, p.intercept, p.marking, p.offball_run
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

// DELETE Session (and all related data)
sessions.delete('/:id', async (c) => {
    const sessionId = c.req.param('id')

    // Delete in order to respect foreign keys
    // 1. Player match stats (depends on matches)
    await c.env.DB.prepare(`
        DELETE FROM player_match_stats 
        WHERE match_id IN (SELECT id FROM matches WHERE session_id = ?)
    `).bind(sessionId).run()

    // 2. Matches
    await c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId).run()

    // 3. Team members (depends on teams)
    await c.env.DB.prepare(`
        DELETE FROM team_members 
        WHERE team_id IN (SELECT id FROM teams WHERE session_id = ?)
    `).bind(sessionId).run()

    // 4. Teams
    await c.env.DB.prepare('DELETE FROM teams WHERE session_id = ?').bind(sessionId).run()

    // 5. Attendance
    await c.env.DB.prepare('DELETE FROM attendance WHERE session_id = ?').bind(sessionId).run()

    // 6. Session
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()

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
