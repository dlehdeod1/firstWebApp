import { Hono } from 'hono'
import { Bindings } from '../types'
import { AbilityService } from '../services/AbilityService'

const matches = new Hono<{ Bindings: Bindings }>()

// Helper: Check Permission
const checkPermission = async (c: any, minRole: 'MATCH_RECORDER' | 'OWNER') => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return false

    // 1. Get User ID
    let userId = null
    if (token === 'demo_admin_token') userId = '1'
    else if (token.startsWith('user:')) userId = token.split(':')[1]

    if (!userId) return false

    // 2. Get User Role from DB
    const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first()
    if (!user) return false

    const role = user.role || 'GUEST'

    // 3. Hierarchy Checks
    // ADMIN > OWNER > MATCH_RECORDER > OTHERS

    if (role === 'ADMIN') return true // ADMIN has full access

    if (minRole === 'OWNER') {
        // OWNER permissions request: Now only ADMIN or OWNER can do OWNER-level stuff? 
        // Wait, request said OWNER is downgraded. 
        // But if we have 'OWNER' minRole check, does it mean "Super Admin" check?
        // Let's assume minRole='OWNER' means "Full Admin Access" in legacy context, so strictly ADMIN now.
        // Actually, let's keep it safe:
        // If minRole is OWNER, it usually meant DELETE matches. 
        // User said OWNER shouldn't edit players. But Match Deletion?
        // "owner has ... match recorder permissions + view player list (Edit X)"
        // It implies OWNER cannot Delete Matches? Or can they?
        // Let's assume OWNER = Match Recorder + View. So OWNER cannot DELETE matches (if DELETE was OWNER-only).
        // Let's reserve 'OWNER' check for strictly ADMIN actions then.
        // Or rename minRole to 'ADMIN' text in calls?
        // Let's stick to: "If minRole is 'OWNER', allow ADMIN only (since OWNER is downgraded)."
        return role === 'ADMIN'
    }

    if (minRole === 'MATCH_RECORDER') {
        // ADMIN, OWNER, MATCH_RECORDER can record matches
        return role === 'ADMIN' || role === 'OWNER' || role === 'MATCH_RECORDER'
    }

    return false
}

// Check Permission Middleware for Routes below? 
// Or just inline check. Inline is safer for partial protection.

matches.post('/:id/generate-3team', async (c) => {
    if (!await checkPermission(c, 'MATCH_RECORDER')) return c.json({ error: 'Unauthorized' }, 401)

    const sessionId = c.req.param('id')
    const { totalMatches = 9, duration = 10 } = await c.req.json()

    // 1. Get Teams for Session
    const { results: teams } = await c.env.DB.prepare('SELECT id, name FROM teams WHERE session_id = ? ORDER BY id').bind(sessionId).all<{ id: number, name: string }>()

    if (!teams || teams.length !== 3) {
        return c.json({ error: 'Session must have exactly 3 teams' }, 400)
    }

    // 2. Generate Schedule
    // Pattern: 0 vs 1, 1 vs 2, 2 vs 0
    const A = teams[0].id
    const B = teams[1].id
    const C = teams[2].id

    const schedule = []

    // 0: A-B, 1: B-C, 2: C-A
    for (let i = 0; i < totalMatches; i++) {
        let t1, t2;
        const mod = i % 3;
        if (mod === 0) { t1 = A; t2 = B; }
        else if (mod === 1) { t1 = B; t2 = C; }
        else { t1 = C; t2 = A; }

        schedule.push({
            session_id: sessionId,
            match_no: i + 1,
            team1_id: t1,
            team2_id: t2,
            duration_min: duration
        })
    }

    // 3. Insert into DB
    const stmt = c.env.DB.prepare(
        'INSERT INTO matches (session_id, match_no, team1_id, team2_id, duration_min) VALUES (?, ?, ?, ?, ?)'
    )

    await c.env.DB.batch(
        schedule.map(m => stmt.bind(m.session_id, m.match_no, m.team1_id, m.team2_id, m.duration_min))
    )

    return c.json({ success: true, count: schedule.length })
})


// Generic Match Update (Score + Teams)
matches.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()

    const updates: string[] = []
    const values: any[] = []

    if (body.team1_id !== undefined) { updates.push('team1_id = ?'); values.push(body.team1_id); }
    if (body.team2_id !== undefined) { updates.push('team2_id = ?'); values.push(body.team2_id); }
    if (body.team1_score !== undefined) { updates.push('team1_score = ?'); values.push(body.team1_score); }
    if (body.team2_score !== undefined) { updates.push('team2_score = ?'); values.push(body.team2_score); }

    if (updates.length > 0) {
        values.push(id)
        await c.env.DB.prepare(`UPDATE matches SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
    }
    return c.json({ success: true })
})

// Legacy Score support (can be deprecated)
matches.put('/:id/score', async (c) => {
    const id = c.req.param('id')
    const { team1_score, team2_score } = await c.req.json()

    await c.env.DB.prepare(
        'UPDATE matches SET team1_score = ?, team2_score = ? WHERE id = ?'
    ).bind(team1_score, team2_score, id).run()

    return c.json({ success: true })
})

// CREATE Manual Match
matches.post('/', async (c) => {
    const { session_id, match_no, team1_id, team2_id } = await c.req.json()

    // Auto-increment match_no if not provided
    let nextMatchNo = match_no
    if (!nextMatchNo) {
        const last = await c.env.DB.prepare('SELECT MAX(match_no) as m FROM matches WHERE session_id = ?').bind(session_id).first()
        nextMatchNo = (last?.m as number || 0) + 1
    }

    const res = await c.env.DB.prepare(
        'INSERT INTO matches (session_id, match_no, team1_id, team2_id) VALUES (?, ?, ?, ?) RETURNING id'
    ).bind(session_id, nextMatchNo, team1_id, team2_id).first()

    return c.json({ id: res?.id, match_no: nextMatchNo, success: true })
})

// DELETE Match
matches.delete('/:id', async (c) => {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(id).run()
    return c.json({ success: true })
})

// RECORD EVENT (Goal/Assist)
matches.post('/:id/events', async (c) => {
    const matchId = c.req.param('id')
    const { type, scorerId, assisterId, teamId } = await c.req.json()

    // Validate IDs
    const nTeamId = Number(teamId)
    const nScorerId = Number(scorerId)
    const nAssisterId = assisterId ? Number(assisterId) : null

    try {
        await c.env.DB.batch([
            // 1. Update Match Score
            c.env.DB.prepare(`
                UPDATE matches 
                SET 
                    team1_score = CASE WHEN team1_id = ? THEN team1_score + 1 ELSE team1_score END,
                    team2_score = CASE WHEN team2_id = ? THEN team2_score + 1 ELSE team2_score END
                WHERE id = ?
            `).bind(nTeamId, nTeamId, matchId),

            // 2. Scorer Stats (Upsert)
            c.env.DB.prepare(`
                INSERT INTO player_match_stats (player_id, match_id, goals) VALUES (?, ?, 1)
                ON CONFLICT(player_id, match_id) DO UPDATE SET goals = goals + 1
            `).bind(nScorerId, matchId),

            // 3. Assister Stats (Upsert) - Only if exists
            ...(nAssisterId ? [
                c.env.DB.prepare(`
                    INSERT INTO player_match_stats (player_id, match_id, assists) VALUES (?, ?, 1)
                    ON CONFLICT(player_id, match_id) DO UPDATE SET assists = assists + 1
                `).bind(nAssisterId, matchId)
            ] : [])
        ])

        // Trigger AI Stat Adjustment
        const changes = []

        // Scorer
        const scorerRes = await AbilityService.adjustPlayerStats(c.env.DB, nScorerId, { goals: 1, assists: 0, attendance: false })
        if (scorerRes?.changes) changes.push(...scorerRes.changes.map(c => ({ ...c, playerId: nScorerId })))

        // Assister
        if (nAssisterId) {
            const assisterRes = await AbilityService.adjustPlayerStats(c.env.DB, nAssisterId, { goals: 0, assists: 1, attendance: false })
            if (assisterRes?.changes) changes.push(...assisterRes.changes.map(c => ({ ...c, playerId: nAssisterId })))
        }

        return c.json({ success: true, changes })
    } catch (e) {
        console.error(e)
        return c.json({ error: 'Event recording failed' }, 500)
    }
})

export default matches
