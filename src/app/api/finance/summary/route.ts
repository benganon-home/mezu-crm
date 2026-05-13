// Profit & loss summary for the finance hub.
// Returns 12 months of revenue vs expenses, plus current-month breakdown:
//   - revenue:   sum(orders.total_price) by created_at month
//   - cogs:      sum(order_items.product.unit_cost) by order created_at month
//   - expenses:  sum(expenses.amount) for active rows, grouped by document_date month + category
//   - margin:    revenue - cogs - expenses
//
// All money values reported in two flavors:
//   gross_*  — as stored (כולל מע״מ on expenses, charged amount on orders)
//   net_*    — divided by 1.18 (Israeli VAT), the "true" P&L number
//
// Query params: ?months=12 (default), ?to=YYYY-MM (default: current month)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const VAT_DIVISOR = 1.18

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthStart(key: string): string {
  return `${key}-01`
}

function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m, 1)
  return ymKey(d)
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return ymKey(d)
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const months = Math.min(Math.max(parseInt(searchParams.get('months') || '12'), 1), 36)
  const today  = new Date()
  const toMonth = searchParams.get('to') || ymKey(today)

  const fromMonth = shiftMonth(toMonth, -(months - 1))
  const fromIso   = monthStart(fromMonth)
  const toIso     = monthStart(nextMonth(toMonth)) // exclusive

  // ── Orders revenue + COGS (single pass) ────────────────────────
  const { data: ordersRaw, error: oErr } = await supabase
    .from('orders')
    .select(`id, created_at, total_price, items:order_items(product_id, price, products:products(unit_cost))`)
    .gte('created_at', fromIso)
    .lt('created_at', toIso)

  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })

  // ── Expenses (active invoices, by document_date) ──────────────
  const { data: expRaw, error: eErr } = await supabase
    .from('expenses')
    .select(`document_date, amount, category:expense_categories(id, name_he, color)`)
    .eq('status', 'active')
    .gte('document_date', fromIso)
    .lt('document_date', toIso)
    .not('amount', 'is', null)

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  // ── Monthly purchase items (manually tracked, not invoiced) ──
  const { data: purchRaw, error: pErr } = await supabase
    .from('monthly_purchases')
    .select(`month, quantity, unit_price, category:expense_categories(id, name_he, color)`)
    .gte('month', fromMonth)
    .lte('month', toMonth)

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // ── Build monthly buckets ──────────────────────────────────────
  type CatBreakdown = { id: string | null; name: string; color: string; total: number }
  type MonthRow = {
    month:         string
    revenue_gross: number
    revenue_net:   number
    cogs_gross:    number
    cogs_net:      number
    expenses_gross:number
    expenses_net:  number
    profit_gross:  number
    profit_net:    number
    margin_pct:    number
    orders_count:  number
    categories:    CatBreakdown[]
  }

  const buckets = new Map<string, MonthRow>()
  for (let i = 0; i < months; i++) {
    const m = shiftMonth(fromMonth, i)
    buckets.set(m, {
      month: m,
      revenue_gross: 0, revenue_net: 0,
      cogs_gross:    0, cogs_net:    0,
      expenses_gross:0, expenses_net:0,
      profit_gross:  0, profit_net:  0,
      margin_pct:    0,
      orders_count:  0,
      categories:    [],
    })
  }

  // Orders → revenue + cogs
  for (const o of (ordersRaw || []) as any[]) {
    const m = ymKey(new Date(o.created_at))
    const b = buckets.get(m)
    if (!b) continue
    const rev = Number(o.total_price || 0)
    b.revenue_gross += rev
    b.orders_count  += 1
    for (const it of o.items || []) {
      const uc = Number(it?.products?.unit_cost || 0)
      b.cogs_gross += uc
    }
  }

  // Expenses → category totals
  const catMaps = new Map<string, Map<string, CatBreakdown>>()
  for (const m of buckets.keys()) catMaps.set(m, new Map())

  for (const e of (expRaw || []) as any[]) {
    const m = ymKey(new Date(e.document_date))
    const b = buckets.get(m); if (!b) continue
    const amt = Number(e.amount || 0)
    b.expenses_gross += amt
    const catId = e.category?.id ?? 'none'
    const catName = e.category?.name_he ?? 'ללא קטגוריה'
    const catColor = e.category?.color ?? '#9490B8'
    const catMap = catMaps.get(m)!
    const cur = catMap.get(catId) || { id: catId === 'none' ? null : catId, name: catName, color: catColor, total: 0 }
    cur.total += amt
    catMap.set(catId, cur)
  }

  // Monthly purchases → fold into the same expense totals + categories.
  // Source: each row's month string directly (no date parsing).
  for (const p of (purchRaw || []) as any[]) {
    const m = p.month
    const b = buckets.get(m); if (!b) continue
    const amt = Number(p.quantity || 0) * Number(p.unit_price || 0)
    b.expenses_gross += amt
    const catId = p.category?.id ?? 'none'
    const catName = p.category?.name_he ?? 'ללא קטגוריה'
    const catColor = p.category?.color ?? '#9490B8'
    const catMap = catMaps.get(m)!
    const cur = catMap.get(catId) || { id: catId === 'none' ? null : catId, name: catName, color: catColor, total: 0 }
    cur.total += amt
    catMap.set(catId, cur)
  }

  // Net-of-VAT + profit + margin
  for (const b of buckets.values()) {
    b.revenue_net  = round2(b.revenue_gross  / VAT_DIVISOR)
    b.cogs_net     = round2(b.cogs_gross     / VAT_DIVISOR)
    b.expenses_net = round2(b.expenses_gross / VAT_DIVISOR)
    b.profit_gross = round2(b.revenue_gross - b.cogs_gross - b.expenses_gross)
    b.profit_net   = round2(b.revenue_net   - b.cogs_net   - b.expenses_net)
    b.margin_pct   = b.revenue_net > 0 ? round2((b.profit_net / b.revenue_net) * 100) : 0
    b.revenue_gross  = round2(b.revenue_gross)
    b.cogs_gross     = round2(b.cogs_gross)
    b.expenses_gross = round2(b.expenses_gross)

    const catMap = catMaps.get(b.month)!
    b.categories = Array.from(catMap.values())
      .map(c => ({ ...c, total: round2(c.total) }))
      .sort((a, b) => b.total - a.total)
  }

  const rows = Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month))

  // Aggregate totals across the window
  const sum = rows.reduce((acc, r) => ({
    revenue_gross: acc.revenue_gross + r.revenue_gross,
    revenue_net:   acc.revenue_net   + r.revenue_net,
    cogs_gross:    acc.cogs_gross    + r.cogs_gross,
    cogs_net:      acc.cogs_net      + r.cogs_net,
    expenses_gross:acc.expenses_gross+ r.expenses_gross,
    expenses_net:  acc.expenses_net  + r.expenses_net,
    profit_gross:  acc.profit_gross  + r.profit_gross,
    profit_net:    acc.profit_net    + r.profit_net,
    orders_count:  acc.orders_count  + r.orders_count,
  }), {
    revenue_gross: 0, revenue_net: 0,
    cogs_gross: 0, cogs_net: 0,
    expenses_gross: 0, expenses_net: 0,
    profit_gross: 0, profit_net: 0,
    orders_count: 0,
  })

  return NextResponse.json({
    from: fromMonth,
    to:   toMonth,
    months,
    rows,
    totals: {
      ...sum,
      revenue_gross: round2(sum.revenue_gross),
      revenue_net:   round2(sum.revenue_net),
      cogs_gross:    round2(sum.cogs_gross),
      cogs_net:      round2(sum.cogs_net),
      expenses_gross:round2(sum.expenses_gross),
      expenses_net:  round2(sum.expenses_net),
      profit_gross:  round2(sum.profit_gross),
      profit_net:    round2(sum.profit_net),
      margin_pct:    sum.revenue_net > 0 ? round2((sum.profit_net / sum.revenue_net) * 100) : 0,
    },
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
