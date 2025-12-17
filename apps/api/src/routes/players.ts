import { Hono } from 'hono'
import { BadgeService } from '../services/BadgeService'

type Bindings = {
    DB: D1Database
}

const players = new Hono<{ Bindings: Bindings }>()

// Helper: Check Admin Permission (Strict)
const checkAdmin = async (c: any) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return false

    // 1. Get User ID
    let userId = null
    if (token === 'demo_admin_token') userId = '1'
    else if (token.startsWith('user:')) userId = token.split(':')[1]
    if (!userId) return false

    // 2. Get User Role
    const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first()
    return user?.role === 'ADMIN'
}

// ADMIN: Get All Player Preferences
players.get('/preferences', async (c) => {
    if (!await checkAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)

    const { results } = await c.env.DB.prepare(`
        SELECT pp.player_id, pp.rank, p.name as target_name
        FROM player_preferences pp
        JOIN players p ON pp.target_player_id = p.id
        ORDER BY pp.player_id, pp.rank
    `).all()

    return c.json(results || [])
})

players.get('/:id/stats', async (c) => {
    const id = Number(c.req.param('id'))
    const stats = await BadgeService.getStatsByPlayerId(c.env.DB, id)
    return c.json(stats || {})
})

// TEMP: Backfill Player Codes
players.post('/backfill-codes', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT id FROM players WHERE player_code IS NULL').all<{ id: number }>()
    if (!results || results.length === 0) return c.json({ message: 'No players to backfill' })

    const updates = results.map(p => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase()
        return c.env.DB.prepare('UPDATE players SET player_code = ? WHERE id = ?').bind(code, p.id)
    })

    await c.env.DB.batch(updates)
    return c.json({ success: true, count: updates.length })
})

// GET All Players with User Role Info
players.get('/', async (c) => {
    const { results } = await c.env.DB.prepare(`
        SELECT p.*, u.role, u.username as user_username 
        FROM players p 
        LEFT JOIN users u ON p.user_id = u.id 
        ORDER BY p.name ASC
    `).all()

    // Parse JSON fields
    const parsed = results?.map((p: any) => ({
        ...p,
        aliases_json: p.aliases_json ? JSON.parse(p.aliases_json) : []
    }))

    return c.json(parsed || [])
})

// CREATE Player
players.post('/', async (c) => {
    if (!await checkAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const { name } = await c.req.json()

    if (!name) return c.json({ error: 'Name is required' }, 400)

    // Check if exists
    const existing = await c.env.DB.prepare('SELECT * FROM players WHERE name = ?').bind(name).first()
    if (existing) {
        return c.json({ id: existing.id, exists: true }) // Return existing ID
    }

    // Generate Random 6-char Code
    const playerCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const res = await c.env.DB.prepare('INSERT INTO players (name, player_code, link_status, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch()) RETURNING id')
        .bind(name, playerCode, 'NONE')
        .first()
    return c.json({ id: res?.id, success: true })
})

// UPDATE Player
players.put('/:id', async (c) => {
    if (!await checkAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)

    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const {
        name, player_code,
        shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, physical
    } = body

    try {
        await c.env.DB.prepare(`
            UPDATE players SET
                name = COALESCE(?, name),
                player_code = COALESCE(?, player_code),
                shooting = COALESCE(?, shooting),
                offball_run = COALESCE(?, offball_run),
                ball_keeping = COALESCE(?, ball_keeping),
                passing = COALESCE(?, passing),
                intercept = COALESCE(?, intercept),
                marking = COALESCE(?, marking),
                stamina = COALESCE(?, stamina),
                speed = COALESCE(?, speed),
                physical = COALESCE(?, physical),
                updated_at = unixepoch()
            WHERE id = ?
        `).bind(
            name, player_code,
            shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, physical,
            id
        ).run()

        return c.json({ success: true })
    } catch (e) {
        console.error(e)
        return c.json({ error: 'Update failed' }, 500)
    }
})

// Link User to Player (Manual Admin Link)
players.post('/:id/link-user', async (c) => {
    if (!await checkAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const id = c.req.param('id')
    const { userId } = await c.req.json()

    if (!userId) return c.json({ error: 'User ID is required' }, 400)

    try {
        await c.env.DB.batch([
            c.env.DB.prepare('UPDATE players SET user_id = ?, link_status = ? WHERE id = ?').bind(userId, 'ACTIVE', id),
            // Auto-upgrade to MEMBER if currently GUEST (optional, but good UX)
            c.env.DB.prepare("UPDATE users SET role = 'CORNERKICKS_MEMBER' WHERE id = ? AND (role IS NULL OR role = 'GUEST')").bind(userId)
        ])
        return c.json({ success: true })
    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return c.json({ error: 'This user is already linked to another player' }, 409)
        }
        console.error(e)
        return c.json({ error: 'Link failed' }, 500)
    }
})

// Approve Link Request
players.post('/:id/approve', async (c) => {
    if (!await checkAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const id = c.req.param('id')
    try {
        // Get linked user first
        const player = await c.env.DB.prepare('SELECT user_id FROM players WHERE id = ?').bind(id).first<{ user_id: string }>()
        if (!player || !player.user_id) return c.json({ error: 'No pending user' }, 400)

        await c.env.DB.batch([
            c.env.DB.prepare("UPDATE players SET link_status = 'ACTIVE' WHERE id = ?").bind(id),
            // Auto-upgrade User Role to MEMBER if they are GUEST
            c.env.DB.prepare("UPDATE users SET role = 'CORNERKICKS_MEMBER' WHERE id = ? AND (role IS NULL OR role = 'GUEST')").bind(player.user_id)
        ])

        return c.json({ success: true })
    } catch (e) {
        return c.json({ error: 'Approve failed' }, 500)
    }
})

// Unlink User
players.post('/:id/unlink-user', async (c) => {
    if (!await checkAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const id = c.req.param('id')
    try {
        await c.env.DB.prepare("UPDATE players SET user_id = NULL, link_status = 'NONE' WHERE id = ?").bind(id).run()
        return c.json({ success: true })
    } catch (e) {
        return c.json({ error: 'Unlink failed' }, 500)
    }
})

// DELETE Player
players.delete('/:id', async (c) => {
    if (!await checkAdmin(c)) return c.json({ error: 'Unauthorized' }, 401)
    const id = c.req.param('id')
    try {
        await c.env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run()
        return c.json({ success: true })
    } catch (e) {
        return c.json({ error: 'Delete failed' }, 500)
    }
})

export default players
