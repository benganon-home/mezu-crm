import { NextResponse } from 'next/server'
import { getToken } from '@/lib/morning'

const BASE = 'https://api.greeninvoice.co.il/api/v1'

// Income document types in Morning API:
// 20 = חשבונית מס, 305 = חשבונית מס / קבלה, 400 = קבלה, 10 = הצעת מחיר (skip), 100 = הזמנה (skip)
const INCOME_TYPES = [20, 305, 400]

// GET /api/morning-revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  // Default: current month
  const now   = new Date()
  const from  = searchParams.get('from') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to    = searchParams.get('to')   || now.toISOString().split('T')[0]

  try {
    const token = await getToken()

    // Fetch all documents for the period — paginate to get everything
    // IMPORTANT: Never use aggregations — they are unreliable for date-filtered totals
    let total = 0
    let page  = 1
    let totalDocs = 0

    while (true) {
      const res = await fetch(`${BASE}/documents/search`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSize:         100,
          page,
          documentDateFrom: from,
          documentDateTo:   to,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage || `Morning error ${res.status}`)

      const docs = data.items ?? []
      if (docs.length === 0) break

      for (const doc of docs) {
        if (INCOME_TYPES.includes(doc.type)) {
          total += doc.amount ?? 0
        }
      }

      totalDocs += docs.length
      if (docs.length < 100) break // last page
      page++
    }

    return NextResponse.json({ from, to, total: Math.round(total * 100) / 100, total_docs: totalDocs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
