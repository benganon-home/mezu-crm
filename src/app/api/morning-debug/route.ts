import { NextResponse } from 'next/server'

const BASE = 'https://api.greeninvoice.co.il/api/v1'

async function getToken(): Promise<string> {
  const res  = await fetch(`${BASE}/account/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: process.env.MORNING_API_KEY, secret: process.env.MORNING_API_SECRET }),
  })
  const d = await res.json()
  return d.token
}

async function probe(label: string, url: string, init: RequestInit) {
  try {
    const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    const text = await res.text()
    return { label, status: res.status, body: text.slice(0, 500) }
  } catch (e: any) {
    return { label, error: e.message }
  }
}

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get('phone') || '0508642482'
  const token = await getToken()
  const h     = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const body  = JSON.stringify({ type: 320, pageSize: 5, page: 1, 'client.phone': phone })

  const results = await Promise.all([
    probe('GET  /documents',         `${BASE}/documents`,         { headers: h }),
    probe('GET  /documents?type=320',`${BASE}/documents?type=320&pageSize=5`, { headers: h }),
    probe('POST /documents/search',  `${BASE}/documents/search`,  { method: 'POST', headers: h, body }),
    probe('POST /documents',         `${BASE}/documents`,         { method: 'POST', headers: h, body }),
    probe('GET  /document',          `${BASE}/document`,          { headers: h }),
    probe('GET  /documents?client.phone', `${BASE}/documents?type=320&pageSize=5&clientPhone=${phone}`, { headers: h }),
  ])

  return NextResponse.json(results)
}
