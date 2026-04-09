import { NextResponse } from 'next/server'

const MAKE_BASE = 'https://eu1.make.com/api/v2'
const DS_ID     = '111813'
const TEAM_ID   = '1416079'

export async function GET() {
  const token = process.env.MAKE_API_TOKEN
  if (!token) return NextResponse.json([])

  const res = await fetch(
    `${MAKE_BASE}/data-store-records?dataStoreId=${DS_ID}&teamId=${TEAM_ID}&pg[limit]=100`,
    { headers: { Authorization: `Token ${token}` }, cache: 'no-store' }
  )
  if (!res.ok) return NextResponse.json([])

  const json = await res.json()
  return NextResponse.json(json.dataStoreRecords || [])
}
