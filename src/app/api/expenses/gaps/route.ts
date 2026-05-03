// Smart gap detector — finds POTENTIAL MISSING INVOICES based on history.
//
// Logic:
//   1. For every vendor with ≥3 distinct months of activity in the last 12 months:
//   2. Compute monthly coverage between their first sighting and the current month.
//   3. Any month where the vendor is absent → flagged as "missing".
//   4. Confidence is derived from how "monthly" the vendor really is:
//        ratio = months_seen / months_in_range_so_far
//      ≥0.85 → high confidence (almost always pays this month)
//      ≥0.6  → medium confidence
//      ≥0.4  → low (might be ad-hoc; flag but soft)
//      <0.4  → not flagged (treated as one-off vendor)
//   5. The current month is considered "expected" only after the vendor's typical
//      day-of-month has passed (avoid false positives on the 1st of the month).
//
// No reliance on `recurring_expenses` templates — this works on history alone.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface GapRow {
  vendor: string
  category_id: string | null
  category_name: string | null
  category_color: string | null
  missing_month: string         // "YYYY-MM"
  typical_amount: number | null
  typical_day_of_month: number | null
  months_seen: number
  total_months_in_range: number
  confidence: 'high' | 'medium' | 'low'
  is_current_month: boolean
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return ymKey(d)
}

function monthsSince(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export async function GET() {
  const supabase = createClient()
  const today = new Date()
  const currentMonth = ymKey(today)
  const horizon = shiftMonth(currentMonth, -11) // last 12 months window

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('vendor, document_date, amount, status, category_id, category:expense_categories(id, name_he, color)')
    .eq('status', 'active')
    .not('document_date', 'is', null)
    .gte('document_date', `${horizon}-01`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by vendor
  type Row = { vendor: string; document_date: string; amount: number | null; category_id: string | null; category: any }
  const byVendor = new Map<string, Row[]>()
  for (const e of (expenses as unknown as Row[])) {
    const arr = byVendor.get(e.vendor) || []
    arr.push(e)
    byVendor.set(e.vendor, arr)
  }

  const gaps: GapRow[] = []

  for (const [vendor, rows] of byVendor.entries()) {
    // Distinct months for this vendor
    const months = new Set<string>()
    let amountSum = 0
    let amountCount = 0
    let daySum = 0
    let dayCount = 0

    for (const r of rows) {
      months.add(r.document_date.slice(0, 7))
      if (r.amount != null) { amountSum += Number(r.amount); amountCount++ }
      const day = parseInt(r.document_date.slice(8, 10), 10)
      if (Number.isFinite(day)) { daySum += day; dayCount++ }
    }

    if (months.size < 3) continue // not enough history to flag

    const sortedMonths = Array.from(months).sort()
    const firstMonth = sortedMonths[0]
    const lastSeen = sortedMonths[sortedMonths.length - 1]

    // Tail-discontinued check: if the vendor hasn't appeared in the last 3 months,
    // treat them as ended (subscription cancelled, switched provider, etc.) and skip.
    // Distance is measured in months from lastSeen to currentMonth.
    const lastSeenIdx = monthsSince(lastSeen, currentMonth)
    if (lastSeenIdx >= 3) continue

    // Build the full month range from firstMonth → currentMonth (inclusive)
    const range: string[] = []
    let cur = firstMonth
    while (cur <= currentMonth) {
      range.push(cur)
      cur = shiftMonth(cur, +1)
    }

    const typicalAmount = amountCount ? Math.round((amountSum / amountCount) * 100) / 100 : null
    const typicalDay    = dayCount ? Math.round(daySum / dayCount) : null

    const seenCount = months.size
    const totalSoFar = range.length
    const ratio = seenCount / totalSoFar

    // Confidence buckets
    let confidence: GapRow['confidence']
    if (ratio >= 0.85)      confidence = 'high'
    else if (ratio >= 0.6)  confidence = 'medium'
    else if (ratio >= 0.4)  confidence = 'low'
    else continue // not regular enough — skip

    // Find missing months
    const r0 = rows[0]
    const cat = r0?.category
    for (const m of range) {
      if (months.has(m)) continue

      const isCurrent = m === currentMonth
      // Suppress current month if the vendor's typical day hasn't arrived yet
      if (isCurrent && typicalDay && today.getDate() < typicalDay) continue

      gaps.push({
        vendor,
        category_id: r0?.category_id || null,
        category_name: cat?.name_he || null,
        category_color: cat?.color || null,
        missing_month: m,
        typical_amount: typicalAmount,
        typical_day_of_month: typicalDay,
        months_seen: seenCount,
        total_months_in_range: totalSoFar,
        confidence,
        is_current_month: isCurrent,
      })
    }
  }

  // Sort: current month first, then high → low confidence, then most recent missing first
  const confRank = { high: 0, medium: 1, low: 2 }
  gaps.sort((a, b) => {
    if (a.is_current_month !== b.is_current_month) return a.is_current_month ? -1 : 1
    if (a.confidence !== b.confidence) return confRank[a.confidence] - confRank[b.confidence]
    if (a.missing_month !== b.missing_month) return b.missing_month.localeCompare(a.missing_month)
    return a.vendor.localeCompare(b.vendor)
  })

  return NextResponse.json({
    today: today.toISOString().slice(0, 10),
    current_month: currentMonth,
    count: gaps.length,
    gaps,
  })
}
