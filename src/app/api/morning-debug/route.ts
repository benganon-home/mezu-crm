import { NextResponse } from 'next/server'

const KEY    = process.env.MORNING_API_KEY    || ''
const SECRET = process.env.MORNING_API_SECRET || ''
const BASE   = 'https://api.greeninvoice.co.il/api/v1'

export async function GET() {
  // Step 1: get token
  const tokenRes  = await fetch(`${BASE}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: KEY, secret: SECRET }),
  })
  const tokenData = await tokenRes.json()
  const token     = tokenData.token

  if (!token) return NextResponse.json({ tokenError: tokenData })

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Step 2: test document searches
  const [allDocs, byPhone1, byPhone2] = await Promise.all([
    fetch(`${BASE}/documents?type=320&pageSize=3`, { headers }).then(r => r.json()),
    fetch(`${BASE}/documents?type=320&pageSize=5&client.phone=0526000000`, { headers }).then(r => r.json()),
    fetch(`${BASE}/documents?type=320&pageSize=3&page=1`, { headers }).then(r => r.json()),
  ])

  return NextResponse.json({
    token: token.slice(0, 30) + '...',
    allDocs,
    byPhone1,
    byPhone2_structure: Object.keys(byPhone2),
    byPhone2_sample: JSON.stringify(byPhone2).slice(0, 600),
  })
}
