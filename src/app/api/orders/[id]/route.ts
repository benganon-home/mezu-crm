import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/orders/[id] — update single order
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('orders')
    .update(body)
    .eq('id', params.id)
    .select(`*, customer:customers(*), items:order_items(*)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/orders/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  // Delete items first to avoid FK constraint violation
  await supabase.from('order_items').delete().eq('order_id', params.id)
  const { error } = await supabase.from('orders').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
