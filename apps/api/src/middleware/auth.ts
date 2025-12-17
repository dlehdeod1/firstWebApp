import { Context, Next } from 'hono'

export async function authMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) {
        // For public read routes, we might skip this.
        // But if applied globally or to protected routes:
        return c.json({ error: 'Unauthorized' }, 401)
    }

    // TODO: Verify Supabase JWT
    // const token = authHeader.split(' ')[1]
    // const { payload } = await verify(token)

    // Mock user for now
    c.set('user', { role: 'admin', email: 'admin@example.com' })

    await next()
}

export async function adminGuard(c: Context, next: Next) {
    const user = c.get('user')
    if (!user || user.role !== 'admin') {
        return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
}
