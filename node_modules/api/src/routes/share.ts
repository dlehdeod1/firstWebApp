import { Hono } from 'hono'
import satori from 'satori'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import React from 'react'
import { Bindings } from '../types'

// Load fonts or use minimal defaults? 
// Satori needs font data. 
// For simplicity, we might skip custom font fetching in this MVP or use a CDN fetch if possible inside Worker.
// But Workers can't easily read local files without import.
// I'll try to fetch a Google Font buffer.

const share = new Hono<{ Bindings: Bindings }>()

share.get('/:id/share.png', async (c) => {
    const sessionId = c.req.param('id')
    const { upto } = c.req.query() // for intermediate results

    // 1. Fetch Data
    const session = await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first()
    if (!session) return c.text('Session not found', 404)

    // TODO: Fetch Matches, Teams, Stats

    // 2. Prepare Font (Fetch Noto Sans KR or similar)
    // NOTE: In production, cache this in KV or import as asset
    const fontData = await fetch('https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR-Bold.ttf').then(res => res.arrayBuffer())

    // 3. Render React Component
    const element = React.createElement('div', {
        style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'white', padding: 40 }
    }, [
        React.createElement('h1', { style: { fontSize: 40, color: '#2563EB' } }, (session as any).title || 'Session Report'),
        React.createElement('p', { style: { fontSize: 24, color: 'gray' } }, (session as any).session_date),
        React.createElement('div', { style: { display: 'flex', marginTop: 20 } }, 'Rendering logic placeholder')
    ])

    const svg = await satori(element, {
        width: 800,
        height: 600,
        fonts: [
            {
                name: 'NotoSansKR',
                data: fontData,
                weight: 700,
                style: 'normal',
            },
        ],
    })

    // 4. Convert to PNG
    // Need WASM initialization? @resvg/resvg-wasm usually needs wasm file provided.
    // In CF Workers, we might need to import the wasm file.
    // import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm' (if configured in wrangler)
    // For now, assume standard usage works or provide standard error if missing.
    try {
        await initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm/index_bg.wasm'))
    } catch (e) {
        // initWasm might be called multiple times
    }

    const resvg = new Resvg(svg)
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    return new Response(pngBuffer, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=60'
        }
    })
})

export default share
