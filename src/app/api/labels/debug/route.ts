import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (key) return createClient(url, key)
  return createServerClient()
}

export async function GET() {
  const supabase = getSupabaseAdmin()

  const { data: allReady } = await supabase
    .from('orders')
    .select('id, status, tracking_number')
    .eq('status', 'ready')

  const { data: shipped } = await supabase
    .from('orders')
    .select('id, status, tracking_number')
    .eq('status', 'shipped')
    .not('tracking_number', 'is', null)
    .neq('tracking_number', '')

  return NextResponse.json({
    readyOrders:           allReady,
    shippedWithTracking:   shipped,
  })
}
