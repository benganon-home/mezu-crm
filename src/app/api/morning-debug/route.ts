import { NextResponse } from 'next/server'

const KEY    = process.env.MORNING_API_KEY    || ''
const SECRET = process.env.MORNING_API_SECRET || ''
const BASE   = 'https://api.morning.co/v1'

async function probe(label: string, url: string, init: RequestInit) {
  try {
    const res  = await fetch(url, init)
    const text = await res.text()
    return { label, status: res.status, body: text.slice(0, 400) }
  } catch (e: any) {
    return { label, error: e.message }
  }
}

export async function GET() {
  const basic  = Buffer.from(`${KEY}:${SECRET}`).toString('base64')
  const hJson  = { 'Content-Type': 'application/json' }

  const results = await Promise.all([
    // Token endpoint — JSON body (Green Invoice style)
    probe('token/json-body', `${BASE}/account/token`, {
      method: 'POST', headers: hJson, body: JSON.stringify({ id: KEY, secret: SECRET }),
    }),
    // Token endpoint — Basic header
    probe('token/basic-header', `${BASE}/account/token`, {
      method: 'POST', headers: { ...hJson, Authorization: `Basic ${basic}` },
    }),
    // Documents — Bearer KEY directly
    probe('docs/bearer-key', `${BASE}/documents?type=320&pageSize=1`, {
      headers: { ...hJson, Authorization: `Bearer ${KEY}` },
    }),
    // Documents — Bearer SECRET directly
    probe('docs/bearer-secret', `${BASE}/documents?type=320&pageSize=1`, {
      headers: { ...hJson, Authorization: `Bearer ${SECRET}` },
    }),
    // Documents — x-api-key header
    probe('docs/x-api-key', `${BASE}/documents?type=320&pageSize=1`, {
      headers: { ...hJson, 'x-api-key': KEY },
    }),
    // Documents — no auth (see what error we get)
    probe('docs/no-auth', `${BASE}/documents?type=320&pageSize=1`, {
      headers: hJson,
    }),
    // Try v2 token endpoint
    probe('token/v2-json-body', `https://api.morning.co/v2/account/token`, {
      method: 'POST', headers: hJson, body: JSON.stringify({ id: KEY, secret: SECRET }),
    }),
  ])

  return NextResponse.json(results)
}
