import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getToken } from '@/lib/morning'

const MORNING_BASE = 'https://api.greeninvoice.co.il/api/v1'

export async function GET() {
  const supabase = createClient()
  const now      = new Date()
  const yearStart = `${now.getFullYear()}-01-01`

  // ── DB: fetch orders + items for this year ────────────────────
  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, customer_id, created_at, total_price, delivery_type, status')
      .gte('created_at', yearStart),
    supabase
      .from('order_items')
      .select('color, font, model, item_name, order_id'),
  ])

  const orders = ordersRes.data || []
  const items  = itemsRes.data || []

  // Monthly breakdown (DB)
  const byMonthMap: Record<string, { count: number; revenue: number }> = {}
  orders.forEach(o => {
    const m = o.created_at.slice(0, 7)
    if (!byMonthMap[m]) byMonthMap[m] = { count: 0, revenue: 0 }
    byMonthMap[m].count++
    byMonthMap[m].revenue += o.total_price || 0
  })
  const byMonth = Object.entries(byMonthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  // Repeat customers
  const custOrders: Record<string, number> = {}
  orders.forEach(o => { custOrders[o.customer_id] = (custOrders[o.customer_id] || 0) + 1 })
  const totalCustomers  = Object.keys(custOrders).length
  const repeatCustomers = Object.values(custOrders).filter(n => n > 1).length

  // Top colors
  const colorCount: Record<string, number> = {}
  items.forEach(i => { if (i.color) colorCount[i.color] = (colorCount[i.color] || 0) + 1 })
  const topColors = Object.entries(colorCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([name, count]) => ({ name, count }))

  // Top fonts
  const fontCount: Record<string, number> = {}
  items.forEach(i => { if (i.font) fontCount[i.font] = (fontCount[i.font] || 0) + 1 })
  const topFonts = Object.entries(fontCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, count]) => ({ name, count }))

  // Sign types (שלטי בית only)
  const signCount: Record<string, number> = {}
  items.filter(i => i.model === 'שלטי בית').forEach(i => {
    if (i.item_name) signCount[i.item_name] = (signCount[i.item_name] || 0) + 1
  })
  const topSignTypes = Object.entries(signCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  // Delivery vs pickup
  const deliveryCount = orders.filter(o => o.delivery_type === 'delivery').length
  const pickupCount   = orders.filter(o => o.delivery_type === 'pickup').length

  // By day of week (0=Sun … 6=Sat)
  const dayLabels = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dayCount  = [0, 0, 0, 0, 0, 0, 0]
  orders.forEach(o => { dayCount[new Date(o.created_at).getDay()]++ })
  const byDayOfWeek = dayLabels.map((day, i) => ({ day, count: dayCount[i] }))

  // ── Morning: last 6 months revenue ───────────────────────────
  let morningMonthly: Array<{ month: string; total: number }> = []
  let currentMonthRevenue: number | null = null
  let lastMonthRevenue:    number | null = null

  try {
    const token = await getToken()

    const months = Array.from({ length: 6 }, (_, i) => {
      const d      = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const yr     = d.getFullYear()
      const mo     = String(d.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(yr, d.getMonth() + 1, 0).toISOString().split('T')[0]
      return { key: `${yr}-${mo}`, from: `${yr}-${mo}-01`, to: lastDay }
    }).reverse()

    const results = await Promise.all(months.map(m =>
      fetch(`${MORNING_BASE}/documents/search`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pageSize: 1, page: 1, documentDateFrom: m.from, documentDateTo: m.to }),
      }).then(r => r.json())
    ))

    morningMonthly = months.map((m, i) => ({
      month: m.key,
      total: results[i]?.aggregations?.total?.value
          ?? results[i]?.aggregations?.totalIncome?.value
          ?? 0,
    }))

    currentMonthRevenue = morningMonthly.at(-1)?.total ?? null
    lastMonthRevenue    = morningMonthly.at(-2)?.total ?? null
  } catch {
    // Morning is best-effort
  }

  return NextResponse.json({
    db: {
      totalOrders:         orders.length,
      totalRevenue:        orders.reduce((s, o) => s + (o.total_price || 0), 0),
      avgOrderValue:       orders.length
        ? orders.reduce((s, o) => s + (o.total_price || 0), 0) / orders.length
        : 0,
      repeatCustomersPct:  totalCustomers
        ? Math.round((repeatCustomers / totalCustomers) * 100)
        : 0,
      byMonth,
      topColors,
      topFonts,
      topSignTypes,
      deliveryBreakdown:   { delivery: deliveryCount, pickup: pickupCount },
      byDayOfWeek,
    },
    morning: {
      monthly:      morningMonthly,
      currentMonth: currentMonthRevenue,
      lastMonth:    lastMonthRevenue,
    },
  })
}
