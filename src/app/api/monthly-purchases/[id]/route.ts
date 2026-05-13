import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()
  const updates: Record<string, any> = {}
  if (body.name !== undefined)         updates.name = String(body.name).trim()
  if (body.category_id !== undefined)  updates.category_id = body.category_id || null
  if (body.quantity !== undefined)     updates.quantity = Number(body.quantity)
  if (body.unit_price !== undefined)   updates.unit_price = Number(body.unit_price)
  if (body.notes !== undefined)        updates.notes = body.notes || null
  if (body.display_order !== undefined) updates.display_order = body.display_order

  const { data, error } = await supabase
    .from('monthly_purchases')
    .update(updates)
    .eq('id', params.id)
    .select(`*, category:expense_categories(*)`)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('monthly_purchases').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
