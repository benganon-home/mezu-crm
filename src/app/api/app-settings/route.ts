// Generic key/value settings for the app. Used currently for:
//   accountant: { name, phone }
//
// GET ?key=accountant   → { value }   (or null)
// POST { key, value }   → upsert

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ value: data?.value ?? null })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const { key, value } = body
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const { data, error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
