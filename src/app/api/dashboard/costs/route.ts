// GET/POST /api/dashboard/costs — list / create cost rules for the dashboard.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const KINDS = ['per_order', 'per_delivery_order', 'per_category_item', 'monthly_fixed', 'filament_per_kg', 'percent_of_contribution']

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase.from('dashboard_costs').select('*').order('sort')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const label = String(body.label || '').trim()
  if (!label) return NextResponse.json({ error: 'חסר שם' }, { status: 400 })
  if (!KINDS.includes(body.kind)) return NextResponse.json({ error: 'kind לא תקין' }, { status: 400 })

  const { data, error } = await supabase
    .from('dashboard_costs')
    .insert({
      label,
      kind:     body.kind,
      category: body.category || null,
      amount:   Number(body.amount) || 0,
      sort:     Number(body.sort) || 100,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
