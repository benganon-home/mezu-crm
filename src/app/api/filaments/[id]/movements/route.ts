// POST /api/filaments/[id]/movements — manual stock movement
//   { grams_delta, reason: 'purchase' | 'adjustment', note? }
// GET  /api/filaments/[id]/movements — recent movements (newest first)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const grams = Number(body.grams_delta)
  const reason = body.reason === 'purchase' ? 'purchase' : 'adjustment'
  if (!Number.isFinite(grams) || grams === 0) {
    return NextResponse.json({ error: 'grams_delta חייב להיות מספר שונה מאפס' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('filament_movements')
    .insert({
      filament_id: params.id,
      grams_delta: grams,
      reason,
      note: body.note || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('filament_movements')
    .select('*')
    .eq('filament_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
