import { Hono } from 'hono'
import { BadgeService } from '../services/BadgeService'
import { AbilityService } from '../services/AbilityService'

type Bindings = {
    DB: D1Database
}

const users = new Hono<{ Bindings: Bindings }>()

// Middleware-like helper or just inline check
const getUserIdFromToken = (c: any) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    // TODO: Real JWT verification
    // For now, support the existing demo token
    if (token === 'demo_admin_token') {
        return '1' // Assume Admin is ID '1' (Text)
    }
    if (token && token.startsWith('user:')) {
        return token.split(':')[1]
    }

    return null
}

users.get('/users', async (c) => {
    // Basic Admin Check (Optional but good)
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    // Return all users with role for dropdown and role management
    const { results } = await c.env.DB.prepare('SELECT id, username, email, role FROM users ORDER BY username ASC').all()
    return c.json(results || [])
})

users.get('/me/badges', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const data = await BadgeService.checkBadges(c.env.DB, userId)
    return c.json(data?.badges || [])
})

users.get('/me/stats', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const stats = await BadgeService.getStats(c.env.DB, userId)
    if (!stats) return c.json({ error: 'No stats found' }, 404)

    return c.json(stats)
})

users.get('/me', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    // Fetch User
    const user = await c.env.DB.prepare('SELECT id, email, username, role FROM users WHERE id = ?').bind(userId).first<{ id: string, email: string, username: string | null, role: string }>()
    if (!user) return c.json({ error: 'User not found' }, 404)

    // [CRITICAL] FORCE ADMIN for testuser_id2 (Case Insensitive)
    const lowerUsername = user.username?.toLowerCase() || ''
    console.log(`[DEBUG_CHECK] Username: '${user.username}' (lower: '${lowerUsername}'), Email: '${user.email}'`)

    if (lowerUsername === 'testuser_id2' || user.email === 'testuser_id2') {
        user.role = 'ADMIN'
        console.log('[DEBUG_CHECK] -> FORCE ADMIN APPLIED')
    } else {
        console.log('[DEBUG_CHECK] -> No override applied')
    }

    // [DEBUG] Log Role Access
    console.log(`[API /me] UserID: ${user.id}, Username: ${user.username}, Role: ${user.role}`)

    // Fetch Profile
    const profile = await c.env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(userId).first()

    // Calculate Age
    let age = null
    if (profile && (profile as any).birth_date) {
        const birthYear = parseInt((profile as any).birth_date.split('-')[0])
        const currentYear = new Date().getFullYear()
        if (!isNaN(birthYear)) {
            age = currentYear - birthYear // International Age by Year
        }
    }

    // Fetch Linked Player (Legacy support / Game stats)
    const player = await c.env.DB.prepare('SELECT * FROM players WHERE user_id = ?').bind(userId).first()

    // Check Badges & Records
    const badgeData = await BadgeService.checkBadges(c.env.DB, userId)

    // Fetch Ability Stats
    const abilities = await AbilityService.getStats(c.env.DB, userId)
    const abilityHistory = await AbilityService.getHistory(c.env.DB, userId)

    // If no abilities initialized, maybe auto-init with defaults?
    // Requirement says "Admin sets base", but for seamless UX let's init default 50 if missing.
    let finalAbilities = abilities
    if (!abilities) {
        await AbilityService.initializeStats(c.env.DB, userId, { atk: 50, pm: 50, comp: 50, dil: 50 })
        finalAbilities = await AbilityService.getStats(c.env.DB, userId)
    }

    return c.json({
        user: {
            username: user.username,
            email: user.email,
            role: user.role
        },
        profile: profile ? { ...profile, age } : null,
        player: player || null,
        badges: badgeData?.badges || [],
        records: badgeData?.records || { wins: 0, podiums: 0, goals: 0, assists: 0, attendance: 0, totalScore: 0 },
        abilities: finalAbilities,
        abilityHistory: abilityHistory || []
    })
})

users.patch('/me', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json()
    const { alias, phone, birth_date, height_cm, weight_kg } = body

    // Validation
    if (height_cm && (height_cm < 120 || height_cm > 220)) return c.json({ error: 'Height must be 120-220' }, 400)
    if (weight_kg && (weight_kg < 30 || weight_kg > 150)) return c.json({ error: 'Weight must be 30-150' }, 400)
    // Phone validation (simple check if provided)
    if (phone && !/^[0-9-]{10,13}$/.test(phone)) {
        return c.json({ error: 'Invalid phone number format' }, 400)
    }

    // Check if profile exists
    const existing = await c.env.DB.prepare('SELECT user_id FROM profiles WHERE user_id = ?').bind(userId).first()

    if (existing) {
        // Update
        await c.env.DB.prepare(`
            UPDATE profiles SET
                alias = COALESCE(?, alias),
                phone = COALESCE(?, phone),
                birth_date = COALESCE(?, birth_date),
                height_cm = COALESCE(?, height_cm),
                weight_kg = COALESCE(?, weight_kg),
                updated_at = unixepoch()
            WHERE user_id = ?
        `).bind(
            alias ?? null,
            phone ?? null,
            birth_date ?? null,
            height_cm ?? null,
            weight_kg ?? null,
            userId
        ).run()
    } else {
        // Create
        await c.env.DB.prepare(`
            INSERT INTO profiles(user_id, alias, phone, birth_date, height_cm, weight_kg, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
        `).bind(
            userId,
            alias ?? null,
            phone ?? null,
            birth_date ?? null,
            height_cm ?? null,
            weight_kg ?? null
        ).run()
    }

    return c.json({ success: true })
})

// Admin: Update User Role
users.patch('/users/:id/role', async (c) => {
    const adminId = getUserIdFromToken(c)
    if (!adminId) return c.json({ error: 'Unauthorized' }, 401)

    // Check if requester is ADMIN
    const admin = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(adminId).first<{ role: string }>()
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admin only' }, 403)

    const targetUserId = c.req.param('id')
    const { role } = await c.req.json()

    // Validate role
    const validRoles = ['ADMIN', 'OWNER', 'MATCH_RECORDER', 'member', 'GUEST']
    if (!validRoles.includes(role)) {
        return c.json({ error: 'Invalid role' }, 400)
    }

    try {
        await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = unixepoch() WHERE id = ?')
            .bind(role, targetUserId)
            .run()
        return c.json({ success: true })
    } catch (e: any) {
        console.error('Role update error:', e)
        return c.json({ error: 'Update failed' }, 500)
    }
})

// Claim Player by Code
users.post('/me/claim-player', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const { playerCode } = await c.req.json()
    if (!playerCode) return c.json({ error: 'Code is required' }, 400)

    try {
        // Find player by code
        const player = await c.env.DB.prepare('SELECT id, user_id FROM players WHERE player_code = ?').bind(playerCode).first<{ id: number, user_id: string }>()

        if (!player) return c.json({ error: 'Invalid Player Code' }, 404)
        if (player.user_id) return c.json({ error: 'Player already linked' }, 409)

        // Count current links for this user (Max 1)
        const currentLink = await c.env.DB.prepare('SELECT id FROM players WHERE user_id = ?').bind(userId).first()
        if (currentLink) return c.json({ error: 'You are already linked to a player' }, 400)

        // Link as PENDING
        await c.env.DB.prepare("UPDATE players SET user_id = ?, link_status = 'PENDING' WHERE id = ?").bind(userId, player.id).run()

        return c.json({ success: true })
    } catch (e: any) {
        console.error('Claim Error:', e)
        return c.json({ error: `Claim failed: ${e.message}` }, 500)
    }
})

export default users
