// Monthly-purchase items for the P&L hub.
// Each row represents "an expense I incurred this month" that the user
// tracks manually (filaments, bags, tapes, etc. — things without a formal
// invoice in the expenses table).
//
// GET  ?month=YYYY-MM → rows for that month
// POST                  body: { month, name, category_id?, quantity, unit_price, notes?, display_order? }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('monthly_purchases')
    .select(`*, category:expense_categories(*)`)
    .eq('month', month)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  if (!body.month || !body.name?.trim()) {
    return NextResponse.json({ error: 'month + name required' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('monthly_purchases')
    .insert({
      month:         body.month,
      name:          body.name.trim(),
      category_id:   body.category_id || null,
      quantity:      Number(body.quantity ?? 1),
      unit_price:    Number(body.unit_price ?? 0),
      notes:         body.notes || null,
      display_order: body.display_order ?? 100,
    })
    .select(`*, category:expense_categories(*)`)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
