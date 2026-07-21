// GET  /api/filaments — filaments with computed stock (ledger sum) and demand
//                       (open items weighed via products.weights)
// POST /api/filaments — create a new filament color

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEMAND_STATUSES, itemGrams } from '@/lib/filaments'
import type { FilamentSummary } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()

  const [filsRes, movesRes, openItemsRes] = await Promise.all([
    supabase.from('filaments').select('*').order('color'),
    supabase.from('filament_movements').select('filament_id, grams_delta'),
    supabase
      .from('order_items')
      .select('id, color, size, status, product:products(weights)')
      .in('status', DEMAND_STATUSES),
  ])

  if (filsRes.error) return NextResponse.json({ error: filsRes.error.message }, { status: 400 })

  const stockByFilament = new Map<string, number>()
  for (const m of movesRes.data ?? []) {
    stockByFilament.set(m.filament_id, (stockByFilament.get(m.filament_id) ?? 0) + Number(m.grams_delta))
  }

  // Demand grouped by the color string on the item.
  const demand = new Map<string, { grams: number; items: number; unknown: number }>()
  for (const it of openItemsRes.data ?? []) {
    const color = it.color || '(ללא צבע)'
    const entry = demand.get(color) ?? { grams: 0, items: 0, unknown: 0 }
    entry.items++
    const grams = itemGrams((it.product as any)?.weights, it.size)
    if (grams == null) entry.unknown++
    else entry.grams += grams
    demand.set(color, entry)
  }

  const filaments: FilamentSummary[] = (filsRes.data ?? []).map(f => {
    const stock_g = Math.round(stockByFilament.get(f.id) ?? 0)
    const d = demand.get(f.color)
    const demand_g = Math.round(d?.grams ?? 0)
    const projected_g = stock_g - demand_g
    const status: FilamentSummary['status'] =
      (demand_g > 0 || stock_g > 0) && projected_g < 0 ? 'order'
      : projected_g < f.threshold_grams ? 'low'
      : 'ok'
    demand.delete(f.color)
    return {
      ...f,
      stock_g,
      demand_g,
      demand_items: d?.items ?? 0,
      unknown_weight_items: d?.unknown ?? 0,
      projected_g,
      status,
    }
  })

  // Colors with open demand but no filament row (new colors added after seed).
  const unmapped = [...demand.entries()].map(([color, d]) => ({
    color, demand_items: d.items, unknown_weight_items: d.unknown, demand_g: Math.round(d.grams),
  }))

  return NextResponse.json({ filaments, unmapped })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const color = String(body.color || '').trim()
  if (!color) return NextResponse.json({ error: 'חסר שם צבע' }, { status: 400 })

  const { data, error } = await supabase
    .from('filaments')
    .insert({
      color,
      spool_grams:     Number(body.spool_grams) > 0 ? Number(body.spool_grams) : 1000,
      threshold_grams: Number(body.threshold_grams) >= 0 ? Number(body.threshold_grams) : 1000,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
