import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .order('display_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const name_he = (body.name_he || '').trim()
  if (!name_he) return NextResponse.json({ error: 'שם קטגוריה חסר' }, { status: 400 })

  // Auto-generate slug from Hebrew name
  const slug = name_he
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0590-\u05FF-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // Get next display_order
  const { data: existing } = await supabase
    .from('product_categories')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
  const nextOrder = ((existing?.[0]?.display_order ?? 0) as number) + 1

  const { data, error } = await supabase
    .from('product_categories')
    .upsert({
      slug,
      name_he,
      display_order: nextOrder,
      is_active: true,
    }, { onConflict: 'slug' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
