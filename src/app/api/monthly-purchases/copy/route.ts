// POST /api/monthly-purchases/copy
// body: { month: "YYYY-MM" }
// Copies the most recent prior month's rows into the target month — current
// prices and quantities preserved. Refuses to overwrite if target month
// already has rows (return 409). Returns the inserted rows.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { month } = await req.json()
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 })
  }

  const supabase = createClient()

  // Refuse if target month is non-empty
  const { count } = await supabase
    .from('monthly_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('month', month)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Target month already has items — clear it first or add manually' }, { status: 409 })
  }

  // Find most recent month with rows, before the target
  const { data: priorRows, error: priorErr } = await supabase
    .from('monthly_purchases')
    .select('month')
    .lt('month', month)
    .order('month', { ascending: false })
    .limit(1)
  if (priorErr) return NextResponse.json({ error: priorErr.message }, { status: 500 })
  if (!priorRows || !priorRows.length) {
    return NextResponse.json({ error: 'No prior month found to copy from' }, { status: 404 })
  }
  const sourceMonth = priorRows[0].month

  // Fetch all source-month rows
  const { data: source, error: sErr } = await supabase
    .from('monthly_purchases')
    .select('name, category_id, quantity, unit_price, notes, display_order')
    .eq('month', sourceMonth)
    .order('display_order', { ascending: true })
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  if (!source || source.length === 0) {
    return NextResponse.json({ inserted: 0, source_month: sourceMonth })
  }

  // Insert clones
  const cloned = source.map(r => ({ ...r, month }))
  const { data: inserted, error: insErr } = await supabase
    .from('monthly_purchases')
    .insert(cloned)
    .select(`*, category:expense_categories(*)`)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({
    inserted: inserted?.length ?? 0,
    source_month: sourceMonth,
    rows: inserted ?? [],
  })
}
