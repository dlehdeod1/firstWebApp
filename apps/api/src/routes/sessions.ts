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
        const teamCount = numTeams || 3

        // 1. Fetch attendees with all stats
        const { results: players } = await c.env.DB.prepare(`
            SELECT p.id, p.name, p.shooting, p.offball_run, p.ball_keeping, p.passing, 
                   p.intercept, p.marking, p.stamina, p.speed, p.physical, p.linkup,
                   p.join_date
            FROM players p
            JOIN attendance a ON p.id = a.player_id
            WHERE a.session_id = ?
        `).bind(sessionId).all<any>()

        if (!players || players.length === 0) {
            return c.json({ error: 'No players found for this session' }, 400)
        }

        // 2. Fetch Player Preferences (who likes playing with whom)
        const playerIds = players.map(p => p.id)
        const { results: prefs } = await c.env.DB.prepare(`
            SELECT pp.player_id, pp.target_player_id, pp.rank, p1.name as player_name, p2.name as target_name
            FROM player_preferences pp
            JOIN players p1 ON pp.player_id = p1.id
            JOIN players p2 ON pp.target_player_id = p2.id
            WHERE pp.player_id IN (${playerIds.join(',')})
        `).all<any>()

        // 3. Build player data for AI prompt
        const playerData = players.map((p: any) => ({
            id: p.id,
            name: p.name,
            슈팅: p.shooting || 50,
            침투: p.offball_run || 50,
            킵: p.ball_keeping || 50,
            패스: p.passing || 50,
            차단: p.intercept || 50,
            마킹: p.marking || 50,
            스태미나: p.stamina || 50,
            스피드: p.speed || 50,
            피지컬: p.physical || 50,
            연계: p.linkup || 50,
            overall: Math.round(((p.shooting || 50) + (p.offball_run || 50) + (p.ball_keeping || 50) +
                (p.passing || 50) + (p.intercept || 50) + (p.marking || 50) +
                (p.stamina || 50) + (p.speed || 50) + (p.physical || 50) + (p.linkup || 50)) / 10)
        }))

        // Build preferences info
        const prefsInfo = (prefs || []).map((p: any) =>
            `${p.player_name}→${p.target_name}(${p.rank}순위)`
        ).join(', ')

        // 4. Try Gemini AI for team generation
        let namedTeams: any[] = []
        let aiGenerated = false
        let balanceScore = 0
        let logs: string[] = []

        const apiKey = (c.env as any).GEMINI_API_KEY
        if (apiKey) {
            try {
                // Calculate total OVR sum for reference
                const totalOVR = playerData.reduce((sum, p) => sum + p.overall, 0)
                const targetOVRPerTeam = Math.round(totalOVR / teamCount)

                const prompt = `당신은 축구팀 구성 및 전략 전문가입니다. 팀 밸런스가 가장 중요합니다.

## 선수 목록 (${players.length}명) - 총 OVR 합계: ${totalOVR}
${playerData.map((p, i) => `${i + 1}. ${p.name} (OVR:${p.overall}) - 슈팅:${p.슈팅} 침투:${p.침투} 킵:${p.킵} 패스:${p.패스} 차단:${p.차단} 마킹:${p.마킹} 스태:${p.스태미나} 스피드:${p.스피드} 피지컬:${p.피지컬} 연계:${p.연계}`).join('\\n')}

## 선수 선호도 (같은 팀 희망)
${prefsInfo || '없음'}

## 중요한 요청사항
1. **팀 밸런스 최우선**: 각 팀의 OVR 합계가 ${targetOVRPerTeam} (± 5) 범위 내가 되도록 구성하세요.
2. **인원 균형**: 각 팀에 ${Math.floor(players.length / teamCount)}~${Math.ceil(players.length / teamCount)}명씩 배정하세요.
3. **핵심선수**: 각 팀에서 *가장 OVR이 높은 선수*를 핵심선수로 지정하세요.
4. 선호도가 있는 선수는 가급적 같은 팀으로 배정하세요.
5. 팀명은 해당 팀에서 가장 경험 많은 선수 이름 + "팀"으로 지정하세요.

## 응답 형식 (JSON만)
{
  "teams": [
    {"name":"OOO팀", "players":["선수1","선수2",...], "teamOVR":팀OVR합계숫자, "type":"공격형/수비형/점유형/체력형/밸런스형", "emoji":"⚽", "strategy":"2문장 전략", "keyPlayer":"핵심선수(OVR최고)", "keyPlayerReason":"OVR XX로 팀 최고"}
  ],
  "balanceScore": 85
}
balanceScore는 팀간 OVR 편차가 적을수록 높게 (90점 이상이 좋음).
JSON만 응답하세요.`

                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                    })
                })

                if (geminiRes.ok) {
                    const geminiData = await geminiRes.json() as any
                    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
                    console.log('Gemini Response Text:', responseText.substring(0, 500))
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
                    if (jsonMatch) {
                        const aiResult = JSON.parse(jsonMatch[0])
                        console.log('AI Result teams count:', aiResult.teams?.length)
                        if (aiResult.teams && Array.isArray(aiResult.teams)) {
                            // Map player names to player objects
                            namedTeams = aiResult.teams.map((team: any, idx: number) => {
                                const teamPlayers = (team.players || []).map((name: string) =>
                                    players.find((p: any) => p.name === name)
                                ).filter(Boolean)

                                return {
                                    id: String.fromCharCode(65 + idx),
                                    name: team.name || `Team ${String.fromCharCode(65 + idx)}`,
                                    players: teamPlayers,
                                    type: team.type,
                                    emoji: team.emoji,
                                    strategy: team.strategy,
                                    keyPlayer: team.keyPlayer,
                                    keyPlayerReason: team.keyPlayerReason,
                                    stats: calculateTeamStatsSimple(teamPlayers)
                                }
                            })
                            balanceScore = aiResult.balanceScore || 80
                            aiGenerated = true
                            logs.push('AI가 팀을 구성했습니다.')
                            console.log('AI Team Generation SUCCESS, teams:', namedTeams.length)
                        }
                    } else {
                        console.log('JSON match failed for response')
                    }
                } else {
                    const errText = await geminiRes.text()
                    console.error('Gemini API Error:', geminiRes.status, errText.substring(0, 300))
                    logs.push(`Gemini API 에러: ${geminiRes.status}`)
                }
            } catch (aiError: any) {
                console.error('AI Team Generation failed, falling back to algorithm:', aiError.message)
                logs.push('AI 처리 실패: ' + aiError.message)
            }
        } else {
            console.log('No GEMINI_API_KEY found, using algorithm')
            logs.push('API Key 없음, 알고리즘 사용')
        }

        // 5. Fallback to TeamBalancer algorithm if AI failed
        if (!aiGenerated || namedTeams.length === 0) {
            const balancer = new TeamBalancer(players, [])
            const result = balancer.generate(teamCount)

            namedTeams = result.teams.map((team: any, index: number) => {
                let name = `Team ${String.fromCharCode(65 + index)}`
                if (team.players.length > 0) {
                    const sorted = [...team.players].sort((a: any, b: any) => {
                        const dA = a.join_date ? new Date(a.join_date).getTime() : 9999999999999
                        const dB = b.join_date ? new Date(b.join_date).getTime() : 9999999999999
                        if (Number.isNaN(dA)) return 1
                        if (Number.isNaN(dB)) return -1
                        if (dA !== dB) return dA - dB
                        return a.name.localeCompare(b.name)
                    })
                    if (sorted.length > 0) name = `${sorted[0].name}팀`
                }
                return { ...team, name }
            })
            balanceScore = result.balanceScore
            logs = result.logs
        }

        // 6. Save to DB
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM player_match_stats WHERE match_id IN (SELECT id FROM matches WHERE session_id = ?)').bind(sessionId),
            c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId),
            c.env.DB.prepare('DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE session_id = ?)').bind(sessionId),
            c.env.DB.prepare('DELETE FROM teams WHERE session_id = ?').bind(sessionId)
        ])

        const teamIds: number[] = []
        const validPlayerIds = new Set(players.map((p: any) => p.id))

        for (const team of namedTeams) {
            const scoreStats = team.type ? JSON.stringify({
                type: team.type,
                emoji: team.emoji,
                strategy: team.strategy,
                keyPlayer: team.keyPlayer,
                keyPlayerReason: team.keyPlayerReason
            }) : null

            const res = await c.env.DB.prepare('INSERT INTO teams (session_id, name, score_stats) VALUES (?, ?, ?) RETURNING id')
                .bind(sessionId, team.name, scoreStats)
                .first()
            if (res && res.id) {
                const teamId = res.id as number
                teamIds.push(teamId)

                const validPlayers = team.players.filter((p: any) => validPlayerIds.has(p.id))
                if (validPlayers.length > 0) {
                    const stmt = c.env.DB.prepare('INSERT INTO team_members (team_id, player_id) VALUES (?, ?)')
                    await c.env.DB.batch(validPlayers.map((p: any) => stmt.bind(teamId, p.id)))
                }
            }
        }

        // 7. Generate Matches
        const matches = []
        if (teamIds.length === 3) {
            const [teamA, teamB, teamC] = teamIds
            const cycle = [
                { t1: teamA, t2: teamB },
                { t1: teamB, t2: teamC },
                { t1: teamC, t2: teamA }
            ]
            for (let i = 0; i < 3; i++) matches.push(...cycle)
        } else if (teamIds.length === 2) {
            const [tA, tB] = teamIds
            for (let i = 0; i < 5; i++) matches.push({ t1: tA, t2: tB })
        }

        if (matches.length > 0) {
            const stmt = c.env.DB.prepare('INSERT INTO matches (session_id, team1_id, team2_id, match_no) VALUES (?, ?, ?, ?)')
            await c.env.DB.batch(matches.map((m, idx) => stmt.bind(sessionId, m.t1, m.t2, idx + 1)))
        }

        return c.json({
            success: true,
            teams: namedTeams,
            match_count: matches.length,
            balanceScore,
            logs,
            aiGenerated
        })
    } catch (e: any) {
        console.error('GENERATE ERROR:', e)
        return c.json({ error: e.message, stack: e.stack }, 500)
    }
})

// Helper function for simple team stats calculation
function calculateTeamStatsSimple(players: any[]) {
    let attack = 0, mid = 0, def = 0, base = 0, physical = 0, total = 0
    for (const p of players) {
        attack += (p.shooting || 50) + (p.offball_run || 50)
        mid += (p.ball_keeping || 50) + (p.passing || 50)
        def += (p.intercept || 50) + (p.marking || 50)
        base += (p.stamina || 50) + (p.speed || 50)
        physical += (p.physical || 50)
        total += attack + mid + def + base + physical
    }
    return { attack, mid, def, base, physical, total }
}

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

// UPDATE Team Name (manual override)
sessions.put('/:id/teams/:teamId', async (c) => {
    const teamId = c.req.param('teamId')
    const { name } = await c.req.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return c.json({ error: 'Team name is required' }, 400)
    }

    try {
        await c.env.DB.prepare('UPDATE teams SET name = ? WHERE id = ?').bind(name.trim(), teamId).run()
        return c.json({ success: true })
    } catch (e) {
        console.error(e)
        return c.json({ error: 'Failed to update team name' }, 500)
    }
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

    // Match Stats - aggregate player stats for this session's matches (for MVP calculation)
    const { results: matchStats } = await c.env.DB.prepare(`
        SELECT 
            pms.player_id,
            p.name as player_name,
            SUM(pms.goals) as goals,
            SUM(pms.assists) as assists,
            SUM(pms.key_passes) as key_passes,
            SUM(pms.blocks) as blocks,
            SUM(pms.clearances) as clearances
        FROM player_match_stats pms
        JOIN players p ON pms.player_id = p.id
        WHERE pms.match_id IN (SELECT id FROM matches WHERE session_id = ?)
        GROUP BY pms.player_id
    `).bind(id).all()

    return c.json({
        ...session,
        players: players || [],
        teams: teamsWithMembers || [],
        matches: matches || [],
        matchStats: matchStats || []
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
    try {
        // Get all match IDs for this session first
        const { results: matchIds } = await c.env.DB.prepare(
            'SELECT id FROM matches WHERE session_id = ?'
        ).bind(sessionId).all<{ id: number }>()

        if (matchIds && matchIds.length > 0) {
            const ids = matchIds.map(m => m.id)

            // Delete in order: match_events -> player_match_stats -> matches
            await c.env.DB.batch([
                c.env.DB.prepare(`DELETE FROM match_events WHERE match_id IN (${ids.join(',')})`),
                c.env.DB.prepare(`DELETE FROM player_match_stats WHERE match_id IN (${ids.join(',')})`),
                c.env.DB.prepare('DELETE FROM matches WHERE session_id = ?').bind(sessionId)
            ])
        }

        return c.json({ success: true })
    } catch (e: any) {
        console.error('Delete matches failed:', e)
        return c.json({ error: 'Delete failed', details: e?.message }, 500)
    }
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

// POST /sessions/:id/analyze-teams - Analyze current team compositions
sessions.post('/:id/analyze-teams', async (c) => {
    const sessionId = c.req.param('id')

    try {
        // Get teams with players
        const { results: teams } = await c.env.DB.prepare(`
            SELECT t.id, t.name,
                   GROUP_CONCAT(tm.player_id) as player_ids
            FROM teams t
            LEFT JOIN team_members tm ON tm.team_id = t.id
            WHERE t.session_id = ?
            GROUP BY t.id
        `).bind(sessionId).all<{ id: number, name: string, player_ids: string }>()

        if (!teams || teams.length === 0) {
            return c.json({ error: 'No teams found' }, 400)
        }

        // Get all players with stats
        const { results: allPlayers } = await c.env.DB.prepare('SELECT * FROM players').all<any>()
        const playerMap = new Map(allPlayers?.map(p => [p.id, p]) || [])

        // Analyze each team
        const teamEmojis = ['⚡', '🔥', '💎', '🌟', '🚀']
        const teamTypes = ['공격형', '밸런스형', '수비형', '피지컬형', '기술형']

        for (let i = 0; i < teams.length; i++) {
            const team = teams[i]
            const playerIds = team.player_ids ? team.player_ids.split(',').map(Number) : []
            const players = playerIds.map(id => playerMap.get(id)).filter(Boolean)

            if (players.length === 0) continue

            // Calculate team stats
            let attack = 0, defense = 0, midfield = 0, physical = 0
            players.forEach((p: any) => {
                attack += (p.shooting || 50) + (p.offball_run || 50)
                defense += (p.intercept || 50) + (p.marking || 50)
                midfield += (p.passing || 50) + (p.ball_keeping || 50)
                physical += (p.stamina || 50) + (p.speed || 50)
            })

            const n = players.length
            attack = Math.round(attack / n / 2)
            defense = Math.round(defense / n / 2)
            midfield = Math.round(midfield / n / 2)
            physical = Math.round(physical / n / 2)

            // Determine type
            let type = '밸런스형'
            if (attack > defense + 10 && attack > midfield) type = '공격형'
            else if (defense > attack + 10) type = '수비형'
            else if (physical > 65) type = '피지컬형'
            else if (midfield > 60) type = '기술형'

            // Find key player (highest overall)
            let keyPlayer = players[0]
            players.forEach((p: any) => {
                const overall = ((p.shooting || 50) + (p.passing || 50) + (p.stamina || 50)) / 3
                const keyOverall = ((keyPlayer.shooting || 50) + (keyPlayer.passing || 50) + (keyPlayer.stamina || 50)) / 3
                if (overall > keyOverall) keyPlayer = p
            })

            // Generate strategy
            const strategies = [
                `${type} 팀으로 ${attack > defense ? '공격적인 압박' : '안정적인 수비'}를 추천합니다.`,
                `핵심 선수 ${keyPlayer?.name || '미정'}를 중심으로 경기를 풀어가세요.`,
                `팀 평균 능력치: 공격 ${attack}, 수비 ${defense}, 미드 ${midfield}`
            ]

            // Save to team
            const scoreStats = JSON.stringify({
                emoji: teamEmojis[i % teamEmojis.length],
                type,
                strategy: strategies[0],
                keyPlayer: keyPlayer?.name || '미정',
                keyPlayerReason: `팀 내 최고 능력치`,
                attack, defense, midfield, physical
            })

            await c.env.DB.prepare('UPDATE teams SET score_stats = ? WHERE id = ?')
                .bind(scoreStats, team.id).run()
        }

        return c.json({ success: true, analyzed: teams.length })
    } catch (e: any) {
        console.error('Team analysis failed:', e)
        return c.json({ error: 'Analysis failed', details: e?.message }, 500)
    }
})

export default sessions
