import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OrderStatus } from '@/types'

// POST /api/orders/bulk — update status on multiple orders
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { ids, status }: { ids: string[]; status: OrderStatus } = await req.json()

  if (!ids?.length || !status) {
    return NextResponse.json({ error: 'ids and status required' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ updated: count })
}
