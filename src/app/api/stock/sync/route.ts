import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fulfillFromStock, type FulfillableItem } from '@/lib/stock'

// Apply ready stock to existing orders: scan all 'received' items in active
// orders and mark the ones that match available stock as 'ready' (+ from_stock),
// decrementing stock. Uses the SAME matching as live order creation, so the
// result is identical to what would have happened automatically.
export async function POST() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('order_items')
    .select('id, product_id, size, color, sign_text, orders(status)')
    .eq('status', 'received')
    .is('sign_text', null)
    .not('product_id', 'is', null)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Skip items whose order is cancelled.
  const items = (data ?? []).filter((r: any) => {
    const ord = Array.isArray(r.orders) ? r.orders[0] : r.orders
    return ord?.status !== 'cancelled'
  }) as (FulfillableItem & { id: string })[]

  // Mutates items in place + decrements stock for matches (greedy, optimistic).
  await fulfillFromStock(supabase, items)

  const matchedIds = items.filter(i => i.from_stock).map(i => i.id)
  if (matchedIds.length > 0) {
    await supabase
      .from('order_items')
      .update({ status: 'ready', from_stock: true })
      .in('id', matchedIds)
  }

  return NextResponse.json({ marked: matchedIds.length })
}
