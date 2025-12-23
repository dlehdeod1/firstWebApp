import { Hono } from 'hono'
import { Bindings } from '../types'

const ratings = new Hono<{ Bindings: Bindings }>()

// Helper: Get User ID from Token
const getUserIdFromToken = (c: any): string | null => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return null
    if (token === 'demo_admin_token') return '1'
    if (token.startsWith('user:')) return token.split(':')[1]
    return null
}

// Helper: Check if user is admin/owner
const isAdminOrOwner = async (c: any, userId: string): Promise<boolean> => {
    const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first() as { role: string } | null
    return user?.role === 'ADMIN' || user?.role === 'OWNER'
}

// POST /ratings - Submit a rating for a player
ratings.post('/', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json()
    const { player_id, session_id, shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, overall, comment } = body

    if (!player_id) return c.json({ error: 'player_id required' }, 400)

    try {
        // Check if rating exists (for update)
        const existing = await c.env.DB.prepare(
            'SELECT id FROM player_ratings WHERE player_id = ? AND rater_user_id = ? AND (session_id = ? OR (session_id IS NULL AND ? IS NULL))'
        ).bind(player_id, userId, session_id || null, session_id || null).first()

        if (existing) {
            // Update existing rating
            await c.env.DB.prepare(`
                UPDATE player_ratings SET
                    shooting = ?, offball_run = ?, ball_keeping = ?, passing = ?,
                    intercept = ?, marking = ?, stamina = ?, speed = ?,
                    overall = ?, comment = ?, updated_at = unixepoch()
                WHERE id = ?
            `).bind(shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, overall, comment, existing.id).run()
            return c.json({ success: true, updated: true, id: existing.id })
        } else {
            // Insert new rating
            const res = await c.env.DB.prepare(`
                INSERT INTO player_ratings (player_id, rater_user_id, session_id, shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, overall, comment)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            `).bind(player_id, userId, session_id || null, shooting, offball_run, ball_keeping, passing, intercept, marking, stamina, speed, overall, comment).first()
            return c.json({ success: true, created: true, id: res?.id })
        }
    } catch (e: any) {
        console.error('Rating save error:', e)
        return c.json({ error: 'Failed to save rating', details: e?.message }, 500)
    }
})

// GET /ratings/player/:id - Get aggregated ratings for a player
ratings.get('/player/:id', async (c) => {
    const playerId = c.req.param('id')
    const userId = getUserIdFromToken(c)

    try {
        // Get all ratings for player
        const { results: allRatings } = await c.env.DB.prepare(`
            SELECT pr.*, u.role as rater_role, u.username as rater_username
            FROM player_ratings pr
            JOIN users u ON pr.rater_user_id = u.id
            WHERE pr.player_id = ?
        `).bind(playerId).all()

        if (!allRatings || allRatings.length === 0) {
            return c.json({ playerId, aggregated: null, count: 0, ratings: [] })
        }

        // Separate admin/owner ratings from regular ratings
        const adminRatings = allRatings.filter((r: any) => r.rater_role === 'ADMIN' || r.rater_role === 'OWNER')
        const regularRatings = allRatings.filter((r: any) => r.rater_role !== 'ADMIN' && r.rater_role !== 'OWNER')

        // Calculate weighted average (admin 50%, regular 50%)
        const calcAvg = (ratings: any[], field: string) => {
            const valid = ratings.filter(r => r[field] !== null)
            if (valid.length === 0) return null
            return valid.reduce((sum, r) => sum + r[field], 0) / valid.length
        }

        const stats = ['shooting', 'offball_run', 'ball_keeping', 'passing', 'intercept', 'marking', 'stamina', 'speed', 'overall']
        const aggregated: any = {}

        stats.forEach(stat => {
            const adminAvg = calcAvg(adminRatings, stat)
            const regularAvg = calcAvg(regularRatings, stat)

            if (adminAvg !== null && regularAvg !== null) {
                // 50% admin + 50% regular
                aggregated[stat] = Math.round((adminAvg * 0.5 + regularAvg * 0.5) * 10) / 10
            } else if (adminAvg !== null) {
                aggregated[stat] = Math.round(adminAvg * 10) / 10
            } else if (regularAvg !== null) {
                aggregated[stat] = Math.round(regularAvg * 10) / 10
            } else {
                aggregated[stat] = null
            }
        })

        // Privacy: Only return detailed ratings if viewer is admin/owner OR is the player being rated
        const player = await c.env.DB.prepare('SELECT user_id FROM players WHERE id = ?').bind(playerId).first() as { user_id: string } | null
        const isOwnerOrPlayer = userId && (await isAdminOrOwner(c, userId) || player?.user_id === userId)

        return c.json({
            playerId,
            aggregated,
            count: allRatings.length,
            adminCount: adminRatings.length,
            regularCount: regularRatings.length,
            // Only show detailed ratings to admins and the player
            ratings: isOwnerOrPlayer ? allRatings.map((r: any) => ({
                id: r.id,
                raterUsername: r.rater_username,
                raterRole: r.rater_role,
                sessionId: r.session_id,
                shooting: r.shooting,
                offball_run: r.offball_run,
                ball_keeping: r.ball_keeping,
                passing: r.passing,
                intercept: r.intercept,
                marking: r.marking,
                stamina: r.stamina,
                speed: r.speed,
                overall: r.overall,
                comment: r.comment,
                createdAt: r.created_at
            })) : []
        })
    } catch (e: any) {
        console.error('Rating fetch error:', e)
        return c.json({ error: 'Failed to fetch ratings', details: e?.message }, 500)
    }
})

// GET /ratings/my/:playerId - Get my rating for a specific player
ratings.get('/my/:playerId', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const playerId = c.req.param('playerId')
    const sessionId = c.req.query('session_id')

    try {
        const rating = await c.env.DB.prepare(`
            SELECT * FROM player_ratings 
            WHERE player_id = ? AND rater_user_id = ? AND (session_id = ? OR (session_id IS NULL AND ? IS NULL))
        `).bind(playerId, userId, sessionId || null, sessionId || null).first()

        return c.json({ rating: rating || null })
    } catch (e: any) {
        console.error('My rating fetch error:', e)
        return c.json({ error: 'Failed to fetch rating' }, 500)
    }
})

// DELETE /ratings/:id - Delete a rating (own rating or admin)
ratings.delete('/:id', async (c) => {
    const userId = getUserIdFromToken(c)
    if (!userId) return c.json({ error: 'Unauthorized' }, 401)

    const ratingId = c.req.param('id')

    try {
        const rating = await c.env.DB.prepare('SELECT rater_user_id FROM player_ratings WHERE id = ?').bind(ratingId).first() as { rater_user_id: number } | null
        if (!rating) return c.json({ error: 'Rating not found' }, 404)

        const isAdmin = await isAdminOrOwner(c, userId)
        if (rating.rater_user_id !== Number(userId) && !isAdmin) {
            return c.json({ error: 'Cannot delete others rating' }, 403)
        }

        await c.env.DB.prepare('DELETE FROM player_ratings WHERE id = ?').bind(ratingId).run()
        return c.json({ success: true })
    } catch (e: any) {
        console.error('Rating delete error:', e)
        return c.json({ error: 'Failed to delete rating' }, 500)
    }
})

export default ratings
