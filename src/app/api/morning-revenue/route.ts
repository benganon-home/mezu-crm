import { NextResponse } from 'next/server'
import { getToken } from '@/lib/morning'

const BASE = 'https://api.greeninvoice.co.il/api/v1'

// GET /api/morning-revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  // Default: current month
  const now   = new Date()
  const from  = searchParams.get('from') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to    = searchParams.get('to')   || now.toISOString().split('T')[0]

  try {
    const token = await getToken()
    const res   = await fetch(`${BASE}/documents/search`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageSize:         1,
        page:             1,
        documentDateFrom: from,
        documentDateTo:   to,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.errorMessage || `Morning error ${res.status}`)

    // Morning returns aggregations with total income
    const total = data.aggregations?.total?.value
               ?? data.aggregations?.totalIncome?.value
               ?? null

    return NextResponse.json({ from, to, total, total_docs: data.total })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
