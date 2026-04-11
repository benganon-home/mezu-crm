import { NextResponse } from 'next/server'

const BASE = 'https://api.greeninvoice.co.il/api/v1'

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/account/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: process.env.MORNING_API_KEY, secret: process.env.MORNING_API_SECRET }),
  })
  return (await res.json()).token
}

async function search(label: string, token: string, body: object) {
  const res  = await fetch(`${BASE}/documents/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await res.json()
  return { label, status: res.status, total: d.total, items: d.items?.length, first: d.items?.[0] ? { id: d.items[0].id, number: d.items[0].number, sum: d.items[0].sum, url: d.items[0].url, date: d.items[0].date, clientName: d.items[0].client?.name, clientPhone: d.items[0].client?.phone } : null }
}

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get('phone') || '0508642482'
  const token = await getToken()

  const results = await Promise.all([
    // No filter — just get all docs to confirm data exists
    search('all-docs-no-filter', token, { pageSize: 3, page: 1 }),
    // Type 320 no phone
    search('type320-no-phone', token, { type: 320, pageSize: 3, page: 1 }),
    // Phone as nested object
    search('client-object', token, { pageSize: 5, page: 1, client: { phone } }),
    // Phone as top-level key
    search('clientPhone-key', token, { pageSize: 5, page: 1, clientPhone: phone }),
    // Phone with type
    search('type320+client-object', token, { type: 320, pageSize: 5, page: 1, client: { phone } }),
    // Try without type, just phone string key
    search('phone-key', token, { pageSize: 5, page: 1, phone }),
  ])

  return NextResponse.json(results)
}
