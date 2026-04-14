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

  // All ready orders regardless of tracking number
  const { data: allReady, error: e1 } = await supabase
    .from('orders')
    .select('id, status, tracking_number')
    .eq('status', 'ready')

  // Ready orders with tracking number (the actual labels/ready filter)
  const { data: withTracking, error: e2 } = await supabase
    .from('orders')
    .select('id, status, tracking_number')
    .eq('status', 'ready')
    .not('tracking_number', 'is', null)
    .neq('tracking_number', '')
    .neq('tracking_number', '0')

  return NextResponse.json({
    serviceRoleKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    allReadyOrders:    { count: allReady?.length ?? 0,      error: e1?.message ?? null, data: allReady },
    readyWithTracking: { count: withTracking?.length ?? 0,  error: e2?.message ?? null, data: withTracking },
  })
}
