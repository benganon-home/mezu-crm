// GET /api/hyp/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Fetches every transaction on the HYP merchant account in the date range,
// then joins back against the orders table so the UI can show three buckets:
//   - matched     → HYP txn with a corresponding order row
//   - hyp_only    → HYP txn with no matching order (phone payments, manual links, etc.)
//   - orders_only → orders with invoice_id but no matching HYP txn (data drift)
//
// Caching: 5 min edge cache. HYP doesn't change history, and the panel is
// only viewed by admins, so the IO load on Supabase is negligible.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listTransactions } from '@/lib/yaadpay'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const from = searchParams.get('from') || ymKey(monthStart)
  const to   = searchParams.get('to')   || ymKey(today)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 })
  }

  const hyp = await listTransactions({ from, to })
  if (!hyp.ok) {
    return NextResponse.json({ error: hyp.error, raw: hyp.raw, endpoint: hyp.endpoint }, { status: 502 })
  }

  // Pull the orders that have HYP invoice IDs in the same range
  const supabase = createClient()
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, order_number, created_at, total_price, invoice_id, customer:customers(name)')
    .gte('created_at', from)
    .lt('created_at', addDay(to))
    .not('invoice_id', 'is', null)
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })

  // Build the join. Match priority: invoice_id ↔ transaction id, fallback order_ref ↔ order_number.
  const ordersByTxn = new Map((orders || []).map((o: any) => [String(o.invoice_id), o]))
  const ordersByOrderNum = new Map((orders || []).map((o: any) => [String(o.order_number || '').slice(0, 8), o]))

  const matched:    Array<{ hyp: any; order: any }> = []
  const hypOnly:    Array<{ hyp: any }>             = []
  const seenOrders: Set<string>                     = new Set()

  for (const t of hyp.transactions) {
    let o = ordersByTxn.get(t.id)
    if (!o && t.order_ref) o = ordersByOrderNum.get(String(t.order_ref).slice(0, 8))
    if (o) {
      matched.push({ hyp: t, order: o })
      seenOrders.add(o.id)
    } else {
      hypOnly.push({ hyp: t })
    }
  }

  const ordersOnly = (orders || []).filter((o: any) => !seenOrders.has(o.id))

  const totals = {
    hyp_total:    hyp.transactions.reduce((s, t) => s + (t.amount || 0), 0),
    orders_total: (orders || []).reduce((s: number, o: any) => s + Number(o.total_price || 0), 0),
    matched_count:    matched.length,
    hyp_only_count:   hypOnly.length,
    orders_only_count: ordersOnly.length,
  }

  return NextResponse.json(
    {
      from, to,
      totals,
      matched,
      hyp_only:    hypOnly,
      orders_only: ordersOnly,
    },
    { headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' } },
  )
}

function addDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(y, m - 1, d + 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}
