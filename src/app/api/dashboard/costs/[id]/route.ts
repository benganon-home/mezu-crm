// PATCH/DELETE /api/dashboard/costs/[id] — edit / remove a cost rule.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if (body.label !== undefined)     patch.label = String(body.label).trim()
  if (body.amount !== undefined)    patch.amount = Number(body.amount) || 0
  if (body.category !== undefined)  patch.category = body.category || null
  if (body.is_active !== undefined) patch.is_active = !!body.is_active
  if (body.sort !== undefined)      patch.sort = Number(body.sort) || 100

  const { data, error } = await supabase
    .from('dashboard_costs').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('dashboard_costs').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
