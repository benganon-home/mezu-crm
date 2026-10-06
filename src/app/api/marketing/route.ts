import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { buildMarketingReport } from '@/lib/marketing'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/marketing — abandoned checkouts, reminder recovery, weekly trend
// and recommended actions. checkout_sessions is store-owned and RLS-locked,
// hence the admin client behind the auth check.
export async function GET() {
  const { data: { user } } = await createServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const now   = new Date()
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString()
  const db    = admin()

  const [sessRes, ordRes] = await Promise.all([
    db.from('checkout_sessions').select('id, created_at, data').gte('created_at', since),
    db.from('orders').select('id, customer_id, created_at, total_price, source, status').gte('created_at', since),
  ])
  if (sessRes.error) return NextResponse.json({ error: sessRes.error.message }, { status: 500 })
  if (ordRes.error)  return NextResponse.json({ error: ordRes.error.message }, { status: 500 })

  const custIds = Array.from(new Set((ordRes.data ?? []).map(o => o.customer_id).filter(Boolean)))
  const { data: customers } = custIds.length
    ? await db.from('customers').select('id, phone, email').in('id', custIds)
    : { data: [] as any[] }

  return NextResponse.json(buildMarketingReport(sessRes.data ?? [], ordRes.data ?? [], customers ?? [], now))
}
