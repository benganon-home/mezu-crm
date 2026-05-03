import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select(`*, category:expense_categories(*)`)
    .order('expected_day_of_month', { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('recurring_expenses')
    .insert(body)
    .select(`*, category:expense_categories(*)`)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
