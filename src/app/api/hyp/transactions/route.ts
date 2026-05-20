// GET /api/hyp/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Reads from the `hyp_transactions` table (populated by /api/hyp/import)
// and reconciles against the orders table. Returns three buckets:
//   - matched     → HYP txn with a corresponding order row
//   - hyp_only    → HYP txn with no matching order
//   - orders_only → orders with invoice_id but no matching HYP txn
//
// HYP's online API doesn't expose a transaction-list endpoint on our
// merchant config, so this view depends on the user importing the CSV
// they download from the HYP merchant portal. Idempotent — re-uploading
// updates existing rows by transaction id.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(y, m - 1, d + 1)
  return ymKey(next)
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

  const supabase = createClient()

  const [{ data: hyp, error: hErr }, { data: orders, error: oErr }] = await Promise.all([
    supabase
      .from('hyp_transactions')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_number, created_at, total_price, invoice_id, customer:customers(name)')
      .gte('created_at', from)
      .lt('created_at', addDay(to))
      .not('invoice_id', 'is', null),
  ])

  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 })
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })

  const hypTxns = hyp || []
  const orderList = orders || []

  // Reconcile by invoice_id (primary), then order_ref ↔ order_number (fallback)
  const ordersByTxn = new Map(orderList.map((o: any) => [String(o.invoice_id), o]))
  const ordersByOrderNum = new Map(orderList.map((o: any) => [String(o.order_number || '').slice(0, 8), o]))

  const matched:   Array<{ hyp: any; order: any }> = []
  const hypOnly:   any[]                           = []
  const seenOrderIds: Set<string>                  = new Set()

  for (const t of hypTxns) {
    let o = ordersByTxn.get(t.id)
    if (!o && t.order_ref) o = ordersByOrderNum.get(String(t.order_ref).slice(0, 8))
    if (o) {
      matched.push({ hyp: t, order: o })
      seenOrderIds.add(o.id)
    } else {
      hypOnly.push(t)
    }
  }

  const ordersOnly = orderList.filter((o: any) => !seenOrderIds.has(o.id))

  const totals = {
    hyp_total:    hypTxns.reduce((s, t) => s + Number(t.amount || 0), 0),
    orders_total: orderList.reduce((s, o: any) => s + Number(o.total_price || 0), 0),
    matched_count:     matched.length,
    hyp_only_count:    hypOnly.length,
    orders_only_count: ordersOnly.length,
    hyp_imported:      hypTxns.length,
  }

  return NextResponse.json({
    from, to,
    totals,
    matched,
    hyp_only:    hypOnly,
    orders_only: ordersOnly,
  })
}
