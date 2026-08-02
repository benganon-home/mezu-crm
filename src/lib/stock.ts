// Auto-fulfillment from ready stock.
//
// When a new order is created, each non-personalized item is matched against
// the stock_items table (by product_id + size + color). If a matching ready
// unit is available, the item is marked 'ready' + from_stock, and one unit is
// consumed. Personalized door signs (with sign_text) are never matched — each
// is unique and can't come from generic stock.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface FulfillableItem {
  product_id?: string | null
  size?: string | null
  color?: string | null
  sign_text?: string | null
  status?: string
  from_stock?: boolean
}

// Null-aware equality filter for a nullable text column.
function eqOrNull(q: any, col: string, val: string | null | undefined) {
  return val == null || val === '' ? q.is(col, null) : q.eq(col, val)
}

/**
 * Global FIFO stock allocation: scan ALL waiting items (status 'received',
 * non-personalized, in non-cancelled orders) ordered oldest-first, and fulfill
 * whatever matches available stock. This is the ONLY way stock is handed out —
 * order creation runs it too (after insert), so a new order can never jump the
 * queue ahead of an older waiting order. Returns how many items were marked.
 */
export async function syncStockToOrders(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, product_id, size, color, sign_text, orders(status)')
    .eq('status', 'received')
    .is('sign_text', null)
    .not('product_id', 'is', null)
    .order('created_at', { ascending: true })
  if (error || !data) return 0

  // Skip items whose order is cancelled.
  const items = data.filter((r: any) => {
    const ord = Array.isArray(r.orders) ? r.orders[0] : r.orders
    return ord?.status !== 'cancelled'
  }) as (FulfillableItem & { id: string })[]

  await fulfillFromStock(supabase, items)

  const matchedIds = items.filter(i => i.from_stock).map(i => i.id)
  if (matchedIds.length > 0) {
    await supabase
      .from('order_items')
      .update({ status: 'ready', from_stock: true })
      .in('id', matchedIds)
  }
  return matchedIds.length
}

/**
 * Mutates each item in place: sets status='ready' + from_stock=true and
 * decrements stock for items that match an available ready unit. Processes
 * sequentially so multiple identical units in one order draw down stock
 * greedily (partial fulfillment). Best-effort — never throws.
 */
export async function fulfillFromStock(supabase: SupabaseClient, items: FulfillableItem[]): Promise<void> {
  for (const item of items) {
    if (item.sign_text) continue        // personalized — not stockable
    if (!item.product_id) continue
    try {
      let sel = supabase
        .from('stock_items')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .gt('quantity', 0)
        .limit(1)
      sel = eqOrNull(sel, 'size', item.size)
      sel = eqOrNull(sel, 'color', item.color)
      const { data: rows } = await sel
      const row = rows?.[0]
      if (!row) continue

      // Optimistic decrement: only succeeds if quantity is unchanged since the
      // read, so two concurrent orders can't double-spend the same unit.
      const { data: updated } = await supabase
        .from('stock_items')
        .update({ quantity: row.quantity - 1, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('quantity', row.quantity)
        .select('id')
      if (updated && updated.length > 0) {
        item.status = 'ready'
        item.from_stock = true
      }
    } catch {
      /* stock fulfillment is best-effort — never block order creation */
    }
  }
}
