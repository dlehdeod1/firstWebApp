import { Hono } from 'hono'

type Bindings = {
    DB: D1Database
}

const auth = new Hono<{ Bindings: Bindings }>()

// Helper to generate IDs (UUID-like or simple random for now)
const generateId = () => crypto.randomUUID()

auth.post('/signup', async (c) => {
    // email is now optional, username is required
    const { username, password, email, phone, birth_date, height_cm, weight_kg } = await c.req.json()

    if (!username || !password) {
        return c.json({ error: 'Username (ID) and password are required' }, 400)
    }

    // 1. Check if user exists (by username)
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
    if (existing) {
        return c.json({ error: 'ID already exists' }, 409)
    }

    // 2. Create User
    const userId = generateId()
    const userEmail = email || `${username}@noemail.conerkicks.com`

    try {
        await c.env.DB.batch([
            c.env.DB.prepare(`
                INSERT INTO users (id, username, email, password, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'member', unixepoch(), unixepoch())
            `).bind(userId, username, userEmail, password),

            c.env.DB.prepare(`
                INSERT INTO profiles (user_id, alias, phone, birth_date, height_cm, weight_kg, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
            `).bind(userId, username, phone || null, birth_date || null, height_cm || null, weight_kg || null)
            // Default alias to username
        ])

        const token = `user:${userId}`

        return c.json({ success: true, token, user: { username, role: 'member' } })
    } catch (e: any) {
        console.error('Signup Error:', e)
        return c.json({ error: 'Signup failed', details: e.message }, 500)
    }
})

auth.post('/login', async (c) => {
    const { username, password } = await c.req.json()

    if (!username || !password) return c.json({ error: 'ID and password required' }, 400)

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first()

    console.log(`[Login Attempt] Username: ${username}, User Found: ${!!user}`)

    if (!user) {
        console.log('[Login Attempt] User not found')
        return c.json({ error: 'Invalid ID or password' }, 401)
    }

    if (user.password !== password) {
        console.log(`[Login Attempt] Password Mismatch. Input: ${password}, Stored: ${user.password}`)
        return c.json({ error: 'Invalid ID or password' }, 401)
    }

    const token = `user:${user.id}`
    return c.json({
        success: true,
        token,
        user: {
            username: user.username,
            email: user.email,
            role: user.role
        }
    })
})

export default auth
