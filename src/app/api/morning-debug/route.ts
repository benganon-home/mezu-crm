import { NextResponse } from 'next/server'
import { getToken } from '@/lib/morning'

const BASE = 'https://api.greeninvoice.co.il/api/v1'

// GET /api/morning-debug?mode=date
// Tests different date filter param names to find which one Morning accepts
export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get('mode') || 'date'

  try {
    const token = await getToken()

    const now  = new Date()
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const to   = now.toISOString().split('T')[0]

    // Try different param name combos
    const variants: Record<string, object> = {
      // variant A — camelCase "documentDate"
      A: { pageSize: 100, page: 1, documentDateFrom: from, documentDateTo: to },
      // variant B — camelCase "date"
      B: { pageSize: 100, page: 1, dateFrom: from, dateTo: to },
      // variant C — "from"/"to"
      C: { pageSize: 100, page: 1, from, to },
      // variant D — Unix timestamps (ms)
      D: {
        pageSize: 100, page: 1,
        documentDateFrom: new Date(from).getTime(),
        documentDateTo:   new Date(to + 'T23:59:59').getTime(),
      },
      // variant E — "createdDateFrom"/"createdDateTo"
      E: { pageSize: 100, page: 1, createdDateFrom: from, createdDateTo: to },
      // variant F — no date (baseline)
      F: { pageSize: 100, page: 1 },
    }

    const body = variants[mode.toUpperCase()] ?? variants['A']

    const res  = await fetch(`${BASE}/documents/search`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    return NextResponse.json({
      mode,
      requestBody: body,
      from,
      to,
      status: res.status,
      total_docs:   data.total,
      aggregations: data.aggregations,
      first_dates:  data.items?.slice(0, 5).map((d: any) => ({
        number: d.number,
        date:   d.documentDate,
        amount: d.amount,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
