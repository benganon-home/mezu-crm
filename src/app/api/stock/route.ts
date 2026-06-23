import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// List all ready-stock items (grouped client-side by category/product).
export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stock_items')
    .select('*')
    .order('category', { ascending: true })
    .order('item_name', { ascending: true })
    .order('size', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Add a ready product. If a row for the same product+size+color already exists,
// increment its quantity instead of creating a duplicate.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const { product_id, item_name, category, size, color } = body
  const qty = Math.max(1, Math.floor(Number(body.quantity) || 1))

  if (!product_id || !item_name) {
    return NextResponse.json({ error: 'חסר מוצר' }, { status: 400 })
  }

  let find = supabase.from('stock_items').select('id, quantity').eq('product_id', product_id)
  find = size ? find.eq('size', size) : find.is('size', null)
  find = color ? find.eq('color', color) : find.is('color', null)
  const { data: existing } = await find.maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('stock_items')
      .update({ quantity: existing.quantity + qty, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 200 })
  }

  const { data, error } = await supabase
    .from('stock_items')
    .insert({
      product_id,
      item_name,
      category: category || null,
      size:     size  || null,
      color:    color || null,
      quantity: qty,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
