// PATCH  /api/filaments/[id] — update color / spool size / threshold / active / notes
// DELETE /api/filaments/[id] — remove a filament (cascades its movements)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const patch: Record<string, unknown> = {}
  if (body.color !== undefined)           patch.color = String(body.color).trim()
  if (body.spool_grams !== undefined)     patch.spool_grams = Number(body.spool_grams)
  if (body.threshold_grams !== undefined) patch.threshold_grams = Number(body.threshold_grams)
  if (body.is_active !== undefined)       patch.is_active = !!body.is_active
  if (body.notes !== undefined)           patch.notes = body.notes || null

  const { data, error } = await supabase
    .from('filaments')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('filaments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
