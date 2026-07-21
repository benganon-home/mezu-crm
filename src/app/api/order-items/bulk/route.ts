import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OrderStatus } from '@/types'
import { syncPrintMovements } from '@/lib/filaments'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { ids, status }: { ids: string[]; status: OrderStatus } = await req.json()

  if (!ids?.length || !status) {
    return NextResponse.json({ error: 'ids and status required' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('order_items')
    .update({ status })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Filament ledger follows item status (deduct on ready/shipped, refund on revert).
  await syncPrintMovements(supabase, ids)

  return NextResponse.json({ updated: count })
}
