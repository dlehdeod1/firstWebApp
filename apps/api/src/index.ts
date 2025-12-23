import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
    DB: D1Database
}

import sessions from './routes/sessions'
import players from './routes/players'
import share from './routes/share'
import matches from './routes/matches'
import users from './routes/users'
import auth from './routes/auth' // Add this
import rankings from './routes/rankings'
import hallOfFame from './routes/hall-of-fame'
import ratings from './routes/ratings'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

app.route('/sessions', sessions)
app.route('/players', players)
app.route('/share', share)
app.route('/matches', matches)
app.route('/auth', auth) // Add this
app.route('/', users)
app.route('/rankings', rankings)
app.route('/hall-of-fame', hallOfFame)
app.route('/ratings', ratings)

app.get('/__routes', (c) => {
    return c.json(app.routes.map(r => ({ method: r.method, path: r.path })))
})

app.get('/', (c) => {
    return c.text('Hello ConerKicks API!')
})

export default app
