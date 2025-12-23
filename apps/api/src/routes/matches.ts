import { Hono } from 'hono'
import { Bindings } from '../types'
import { AbilityService } from '../services/AbilityService'

const matches = new Hono<{ Bindings: Bindings }>()

// Helper: Check Permission (returns userId for tracking if authorized)
const checkPermission = async (c: any, minRole: 'MATCH_RECORDER' | 'OWNER'): Promise<{ allowed: boolean, userId: string | null, username?: string }> => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return { allowed: false, userId: null }

    // 1. Get User ID
    let userId: string | null = null
    if (token === 'demo_admin_token') userId = '1'
    else if (token.startsWith('user:')) userId = token.split(':')[1]

    if (!userId) return { allowed: false, userId: null }

    // 2. Get User Role from DB
    const user = await c.env.DB.prepare('SELECT role, username FROM users WHERE id = ?').bind(userId).first() as { role: string, username?: string } | null
    if (!user) return { allowed: false, userId: null }

    const role = user.role || 'GUEST'

    // 3. Hierarchy Checks
    if (role === 'ADMIN') return { allowed: true, userId, username: user.username }

    if (minRole === 'OWNER') {
        // Only ADMIN can do OWNER-level stuff (like deleting matches)
        return { allowed: role === 'ADMIN', userId, username: user.username }
    }

    if (minRole === 'MATCH_RECORDER') {
        // Allow ALL logged-in users EXCEPT GUEST to record matches
        // ADMIN, OWNER, MATCH_RECORDER, member can all record
        const canRecord = role !== 'GUEST'
        return { allowed: canRecord, userId, username: user.username }
    }

    return { allowed: false, userId: null }
}

// Simple permission check (backward compatible)
const checkPermissionSimple = async (c: any, minRole: 'MATCH_RECORDER' | 'OWNER'): Promise<boolean> => {
    const result = await checkPermission(c, minRole)
    return result.allowed
}

// Check Permission Middleware for Routes below? 
// Or just inline check. Inline is safer for partial protection.

matches.post('/:id/generate-3team', async (c) => {
    if (!(await checkPermission(c, 'MATCH_RECORDER')).allowed) return c.json({ error: 'Unauthorized' }, 401)

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
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }

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
    try {
        // Delete in order: match_events -> player_match_stats -> match
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM match_events WHERE match_id = ?').bind(id),
            c.env.DB.prepare('DELETE FROM player_match_stats WHERE match_id = ?').bind(id),
            c.env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(id)
        ])
        return c.json({ success: true })
    } catch (e: any) {
        console.error('Delete match failed:', e)
        return c.json({ error: 'Delete failed', details: e?.message }, 500)
    }
})

// RECORD EVENT (Goal/Assist/Defense)
matches.post('/:id/events', async (c) => {
    // Check permission and get recorder info
    const auth = await checkPermission(c, 'MATCH_RECORDER')
    if (!auth.allowed) return c.json({ error: 'Unauthorized' }, 401)

    const recordedBy = auth.username || auth.userId || 'unknown'

    const matchId = c.req.param('id')
    const { type, scorerId, assisterId, teamId, eventTime } = await c.req.json()

    // Validate IDs
    const nTeamId = Number(teamId)
    const nScorerId = Number(scorerId)
    const nAssisterId = assisterId ? Number(assisterId) : null
    const nEventTime = eventTime ? Number(eventTime) : 0

    try {
        // Handle non-goal events: KEY_PASS, BLOCK, CLEARANCE
        if (type === 'KEY_PASS') {
            await c.env.DB.batch([
                c.env.DB.prepare(`
                    INSERT INTO player_match_stats (player_id, match_id, key_passes) VALUES (?, ?, 1)
                    ON CONFLICT(player_id, match_id) DO UPDATE SET key_passes = key_passes + 1
                `).bind(nScorerId, matchId),
                c.env.DB.prepare(`
                    INSERT INTO match_events (match_id, player_id, team_id, event_type, event_time) VALUES (?, ?, ?, 'KEY_PASS', ?)
                `).bind(matchId, nScorerId, nTeamId, nEventTime)
            ])
            return c.json({ success: true, type: 'KEY_PASS', playerId: nScorerId, recordedBy })
        }

        if (type === 'BLOCK' || type === 'DEFENSE') {
            await c.env.DB.batch([
                c.env.DB.prepare(`
                    INSERT INTO player_match_stats (player_id, match_id, blocks) VALUES (?, ?, 1)
                    ON CONFLICT(player_id, match_id) DO UPDATE SET blocks = blocks + 1
                `).bind(nScorerId, matchId),
                c.env.DB.prepare(`
                    INSERT INTO match_events (match_id, player_id, team_id, event_type, event_time) VALUES (?, ?, ?, 'DEFENSE', ?)
                `).bind(matchId, nScorerId, nTeamId, nEventTime)
            ])
            return c.json({ success: true, type: 'DEFENSE', playerId: nScorerId, recordedBy })
        }

        if (type === 'CLEARANCE') {
            await c.env.DB.batch([
                c.env.DB.prepare(`
                    INSERT INTO player_match_stats (player_id, match_id, clearances) VALUES (?, ?, 1)
                    ON CONFLICT(player_id, match_id) DO UPDATE SET clearances = clearances + 1
                `).bind(nScorerId, matchId),
                c.env.DB.prepare(`
                    INSERT INTO match_events (match_id, player_id, team_id, event_type, event_time) VALUES (?, ?, ?, 'CLEARANCE', ?)
                `).bind(matchId, nScorerId, nTeamId, nEventTime)
            ])
            return c.json({ success: true, type: 'CLEARANCE', playerId: nScorerId, recordedBy })
        }

        // GOAL event
        await c.env.DB.batch([
            // 1. Update Match Score AND set status to completed
            c.env.DB.prepare(`
                UPDATE matches 
                SET 
                    team1_score = CASE WHEN team1_id = ? THEN team1_score + 1 ELSE team1_score END,
                    team2_score = CASE WHEN team2_id = ? THEN team2_score + 1 ELSE team2_score END,
                    status = 'completed'
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
            ] : []),

            // 4. Save event to match_events for persistence
            c.env.DB.prepare(`
                INSERT INTO match_events (match_id, player_id, team_id, event_type, assister_id, event_time) 
                VALUES (?, ?, ?, 'GOAL', ?, ?)
            `).bind(matchId, nScorerId, nTeamId, nAssisterId, nEventTime)
        ])

        // AI Stat Adjustment removed per user request - stats will be managed via ratings system
        return c.json({ success: true, recordedBy })
    } catch (e: any) {
        console.error('Event recording failed:', e?.message || e)
        return c.json({ error: 'Event recording failed', details: e?.message }, 500)
    }
})

// UNDO/DELETE EVENT (Rollback stats and scores)
matches.delete('/:id/events', async (c) => {
    const matchId = c.req.param('id')
    const { type, scorerId, assisterId, teamId } = await c.req.json()

    const nTeamId = Number(teamId)
    const nScorerId = Number(scorerId)
    const nAssisterId = assisterId ? Number(assisterId) : null

    try {
        // Handle non-goal events: KEY_PASS, BLOCK, CLEARANCE
        if (type === 'KEY_PASS') {
            await c.env.DB.prepare(`
                UPDATE player_match_stats SET key_passes = MAX(0, key_passes - 1) WHERE player_id = ? AND match_id = ?
            `).bind(nScorerId, matchId).run()
            return c.json({ success: true, type: 'KEY_PASS', undone: true })
        }

        if (type === 'BLOCK') {
            await c.env.DB.prepare(`
                UPDATE player_match_stats SET blocks = MAX(0, blocks - 1) WHERE player_id = ? AND match_id = ?
            `).bind(nScorerId, matchId).run()
            return c.json({ success: true, type: 'BLOCK', undone: true })
        }

        if (type === 'CLEARANCE') {
            await c.env.DB.prepare(`
                UPDATE player_match_stats SET clearances = MAX(0, clearances - 1) WHERE player_id = ? AND match_id = ?
            `).bind(nScorerId, matchId).run()
            return c.json({ success: true, type: 'CLEARANCE', undone: true })
        }

        // GOAL event - rollback score and stats
        await c.env.DB.batch([
            // 1. Decrease Match Score
            c.env.DB.prepare(`
                UPDATE matches 
                SET 
                    team1_score = CASE WHEN team1_id = ? THEN MAX(0, team1_score - 1) ELSE team1_score END,
                    team2_score = CASE WHEN team2_id = ? THEN MAX(0, team2_score - 1) ELSE team2_score END
                WHERE id = ?
            `).bind(nTeamId, nTeamId, matchId),

            // 2. Decrease Scorer Goals
            c.env.DB.prepare(`
                UPDATE player_match_stats SET goals = MAX(0, goals - 1) WHERE player_id = ? AND match_id = ?
            `).bind(nScorerId, matchId),

            // 3. Decrease Assister Assists (if exists)
            ...(nAssisterId ? [
                c.env.DB.prepare(`
                    UPDATE player_match_stats SET assists = MAX(0, assists - 1) WHERE player_id = ? AND match_id = ?
                `).bind(nAssisterId, matchId)
            ] : [])
        ])

        return c.json({ success: true, type: 'GOAL', undone: true })
    } catch (e: any) {
        console.error('Event undo failed:', e?.message || e)
        return c.json({ error: 'Event undo failed', details: e?.message }, 500)
    }
})

// GET match events (for log persistence)
matches.get('/:id/events', async (c) => {
    const matchId = c.req.param('id')

    try {
        const { results } = await c.env.DB.prepare(`
            SELECT 
                me.id,
                me.event_type as type,
                me.player_id as playerId,
                p.name as playerName,
                me.team_id as teamId,
                me.assister_id as assisterId,
                a.name as assisterName,
                me.event_time as time,
                me.created_at as createdAt
            FROM match_events me
            JOIN players p ON p.id = me.player_id
            LEFT JOIN players a ON a.id = me.assister_id
            WHERE me.match_id = ?
            ORDER BY me.created_at ASC
        `).bind(matchId).all()

        return c.json({ events: results || [] })
    } catch (e: any) {
        console.error('Get events failed:', e?.message || e)
        return c.json({ events: [], error: e?.message })
    }
})

// Reset match (clear all events and scores)
matches.post('/:id/reset', async (c) => {
    const matchId = c.req.param('id')

    try {
        await c.env.DB.batch([
            // Reset match scores and status
            c.env.DB.prepare(`
                UPDATE matches SET team1_score = 0, team2_score = 0, status = 'pending' WHERE id = ?
            `).bind(matchId),

            // Delete player match stats
            c.env.DB.prepare('DELETE FROM player_match_stats WHERE match_id = ?').bind(matchId),

            // Delete match events
            c.env.DB.prepare('DELETE FROM match_events WHERE match_id = ?').bind(matchId)
        ])

        return c.json({ success: true })
    } catch (e: any) {
        console.error('Reset match failed:', e?.message || e)
        return c.json({ error: 'Reset failed', details: e?.message }, 500)
    }
})

export default matches
