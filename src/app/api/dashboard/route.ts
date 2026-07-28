// GET /api/dashboard?month=YYYY-MM — full P&L for one month:
// revenue (gross / net of VAT), order + item mix, cost lines computed from
// the editable dashboard_costs rules, contribution, tax estimate, net.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { itemGrams } from '@/lib/filaments'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const VAT = 1.18
const r2 = (n: number) => Math.round(n * 100) / 100

function monthRange(month: string): { fromIso: string; toIso: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  const from = new Date(Date.UTC(y, mo - 1, 1))
  const to   = new Date(Date.UTC(y, mo, 1))
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = new URL(req.url).searchParams.get('month') || currentMonth
  const range = monthRange(month)
  if (!range) return NextResponse.json({ error: 'month חייב להיות YYYY-MM' }, { status: 400 })

  const [ordersRes, itemsRes, costsRes, firstOrderRes] = await Promise.all([
    supabase.from('orders')
      .select('id, total_price, delivery_type, status, created_at')
      .gte('created_at', range.fromIso).lt('created_at', range.toIso),
    supabase.from('order_items')
      .select('id, size, price, order:orders!inner(created_at), product:products(category, weights)')
      .gte('order.created_at', range.fromIso).lt('order.created_at', range.toIso),
    supabase.from('dashboard_costs').select('*').order('sort'),
    supabase.from('orders').select('created_at').order('created_at', { ascending: true }).limit(1),
  ])

  if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 400 })

  const orders = (ordersRes.data ?? []).filter(o => o.status !== 'cancelled')
  const cancelledIds = new Set((ordersRes.data ?? []).filter(o => o.status === 'cancelled').map(o => o.id))
  const items = (itemsRes.data ?? []) as any[]

  // ── Revenue + mix ──────────────────────────────────────────────
  const grossRevenue   = orders.reduce((s, o) => s + Number(o.total_price || 0), 0)
  const netRevenue     = grossRevenue / VAT
  const orderCount     = orders.length
  const deliveryOrders = orders.filter(o => o.delivery_type === 'delivery').length
  const pickupOrders   = orderCount - deliveryOrders

  const itemsByCategory = new Map<string, number>()
  let totalGrams = 0
  let itemsMissingWeight = 0
  for (const it of items) {
    const cat = it.product?.category || 'אחר'
    itemsByCategory.set(cat, (itemsByCategory.get(cat) ?? 0) + 1)
    const grams = itemGrams(it.product?.weights, it.size)
    if (grams == null) itemsMissingWeight++
    else totalGrams += grams
  }
  const itemCount = items.length

  // ── Cost lines from the editable rules ─────────────────────────
  const costs = (costsRes.data ?? []) as any[]
  const active = costs.filter(c => c.is_active)

  interface Line { id: string; label: string; kind: string; amount: number; detail: string; total: number }
  const costLines: Line[] = []
  for (const c of active.filter(c => c.kind !== 'percent_of_contribution')) {
    const amount = Number(c.amount) || 0
    let total = 0; let detail = ''
    switch (c.kind) {
      case 'per_order':
        total = amount * orderCount; detail = `${orderCount} הזמנות × ₪${amount}`; break
      case 'per_delivery_order':
        total = amount * deliveryOrders; detail = `${deliveryOrders} משלוחים × ₪${amount}`; break
      case 'per_category_item': {
        const n = itemsByCategory.get(c.category || '') ?? 0
        total = amount * n; detail = `${n} פריטי ${c.category} × ₪${amount}`; break
      }
      case 'monthly_fixed':
        total = amount; detail = 'קבוע חודשי'; break
      case 'filament_per_kg':
        total = (totalGrams / 1000) * amount
        detail = `${(totalGrams / 1000).toFixed(2)} ק״ג × ₪${amount}` +
          (itemsMissingWeight ? ` (חלקי — ${itemsMissingWeight} פריטים ללא משקל)` : '')
        break
    }
    costLines.push({ id: c.id, label: c.label, kind: c.kind, amount, detail, total: r2(total) })
  }

  const totalCosts   = r2(costLines.reduce((s, l) => s + l.total, 0))
  const contribution = r2(netRevenue - totalCosts)

  const taxLines: Line[] = active
    .filter(c => c.kind === 'percent_of_contribution')
    .map(c => ({
      id: c.id, label: c.label, kind: c.kind, amount: Number(c.amount) || 0,
      detail: `${c.amount}% מהרווח התפעולי`,
      total: r2(Math.max(0, contribution) * (Number(c.amount) || 0) / 100),
    }))
  const totalTax = r2(taxLines.reduce((s, l) => s + l.total, 0))
  const netAfterTax = r2(contribution - totalTax)

  // Months available for the picker (first order → current month).
  const firstOrderAt = firstOrderRes.data?.[0]?.created_at
  const monthsAvailable: string[] = []
  if (firstOrderAt) {
    const d = new Date(firstOrderAt); d.setUTCDate(1)
    const end = new Date()
    while (d.getFullYear() < end.getFullYear() || (d.getFullYear() === end.getFullYear() && d.getMonth() <= end.getMonth())) {
      monthsAvailable.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
    monthsAvailable.reverse()
  }

  // Current-month run-rate projection (only meaningful mid-month).
  const isCurrent = month === currentMonth
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth  = now.getDate()
  const projection = isCurrent && dayOfMonth >= 3 && dayOfMonth < daysInMonth
    ? { grossRevenue: r2(grossRevenue / dayOfMonth * daysInMonth), netAfterTax: r2(netAfterTax / dayOfMonth * daysInMonth) }
    : null

  return NextResponse.json({
    month,
    isCurrent,
    monthsAvailable,
    revenue: {
      gross: r2(grossRevenue),
      net:   r2(netRevenue),
      orders: orderCount,
      deliveryOrders,
      pickupOrders,
      items: itemCount,
      itemsByCategory: Object.fromEntries(itemsByCategory),
      avgOrderGross: orderCount ? r2(grossRevenue / orderCount) : 0,
      cancelledOrders: cancelledIds.size,
    },
    filament: { totalKg: r2(totalGrams / 1000), itemsMissingWeight },
    costLines,
    totalCosts,
    contribution,
    taxLines,
    totalTax,
    netAfterTax,
    projection,
  })
}
