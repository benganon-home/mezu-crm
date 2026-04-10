import { NextResponse } from 'next/server'

const KEY    = process.env.MORNING_API_KEY    || ''
const SECRET = process.env.MORNING_API_SECRET || ''

// Correct base URL from Apiary docs
const BASE = 'https://api.greeninvoice.co.il/api/v1'

async function probe(label: string, url: string, init: RequestInit) {
  try {
    const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    const text = await res.text()
    return { label, status: res.status, body: text.slice(0, 500) }
  } catch (e: any) {
    return { label, error: e.message }
  }
}

export async function GET() {
  const basic = Buffer.from(`${KEY}:${SECRET}`).toString('base64')
  const hJson = { 'Content-Type': 'application/json' }

  const results = await Promise.all([
    // Token — JSON body { id, secret }
    probe('token/json-body', `${BASE}/account/token`, {
      method: 'POST', headers: hJson,
      body: JSON.stringify({ id: KEY, secret: SECRET }),
    }),
    // Token — Basic header
    probe('token/basic-header', `${BASE}/account/token`, {
      method: 'POST', headers: { ...hJson, Authorization: `Basic ${basic}` },
    }),
    // Token — empty POST
    probe('token/empty-post', `${BASE}/account/token`, {
      method: 'POST', headers: hJson,
    }),
    // Documents — no auth (see error shape)
    probe('docs/no-auth', `${BASE}/documents?type=320&pageSize=1`, {
      headers: hJson,
    }),
  ])

  return NextResponse.json(results)
}
