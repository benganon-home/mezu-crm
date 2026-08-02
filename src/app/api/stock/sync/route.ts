import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStockToOrders } from '@/lib/stock'

// Apply ready stock to waiting orders — global FIFO pass (oldest 'received'
// items first). The same pass runs automatically after every order creation,
// so this button is the manual "re-check now" trigger after adding stock.
export async function POST() {
  const supabase = createClient()
  const marked = await syncStockToOrders(supabase)
  return NextResponse.json({ marked })
}
