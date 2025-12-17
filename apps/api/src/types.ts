import { D1Database } from '@cloudflare/workers-types'

export type Bindings = {
    DB: D1Database
}

export type Variables = {
    user: {
        role: 'admin' | 'member';
        email: string;
    }
}
