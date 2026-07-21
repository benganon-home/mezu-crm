// Filament inventory logic shared by the API routes.
//
// Model: stock per color = SUM(filament_movements.grams_delta).
//   purchase   +grams  (a spool was bought / loaded)
//   print      -grams  (an order item reached 'ready'/'shipped' — one row per
//                       item, enforced by a partial unique index)
//   adjustment ±grams  (manual correction from the UI)
//
// Demand = items still waiting to be printed (received/preparing), weighed by
// products.weights: { "<size label>": grams, "default": grams }.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderStatus } from '@/types'

export const DEMAND_STATUSES: OrderStatus[]   = ['received', 'preparing']
export const CONSUMED_STATUSES: OrderStatus[] = ['ready', 'shipped']

export function itemGrams(
  weights: Record<string, number> | null | undefined,
  size: string | null | undefined,
): number | null {
  if (!weights) return null
  if (size && weights[size] != null && Number(weights[size]) > 0) return Number(weights[size])
  if (weights.default != null && Number(weights.default) > 0) return Number(weights.default)
  return null
}

// Bring print movements in line with the items' current statuses.
// Called after any order-item status change (single or bulk). Idempotent:
// ready/shipped ⇒ ensure a print deduction exists; any other status ⇒ remove it.
export async function syncPrintMovements(supabase: SupabaseClient, itemIds: string[]) {
  if (!itemIds.length) return
  try {
    const { data: items } = await supabase
      .from('order_items')
      .select('id, status, color, size, product:products(weights)')
      .in('id', itemIds)
    if (!items?.length) return

    const consumed = items.filter(i => CONSUMED_STATUSES.includes(i.status))
    const reverted = items.filter(i => !CONSUMED_STATUSES.includes(i.status))

    if (reverted.length) {
      await supabase
        .from('filament_movements')
        .delete()
        .eq('reason', 'print')
        .in('order_item_id', reverted.map(i => i.id))
    }

    if (consumed.length) {
      const { data: existing } = await supabase
        .from('filament_movements')
        .select('order_item_id')
        .eq('reason', 'print')
        .in('order_item_id', consumed.map(i => i.id))
      const already = new Set((existing ?? []).map(m => m.order_item_id))

      const { data: fils } = await supabase.from('filaments').select('id, color')
      const filByColor = new Map((fils ?? []).map(f => [f.color, f.id]))

      const rows = consumed
        .filter(i => !already.has(i.id))
        .map(i => {
          const filamentId = filByColor.get(i.color || '')
          const grams = itemGrams((i.product as any)?.weights, i.size)
          if (!filamentId || grams == null) return null
          return { filament_id: filamentId, grams_delta: -grams, reason: 'print', order_item_id: i.id }
        })
        .filter(Boolean) as any[]

      if (rows.length) {
        // The partial unique index backstops a race; a duplicate insert error
        // here is harmless and must never fail the status change itself.
        await supabase.from('filament_movements').insert(rows)
      }
    }
  } catch (err) {
    console.error('[filaments] syncPrintMovements failed', {
      itemIds,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
