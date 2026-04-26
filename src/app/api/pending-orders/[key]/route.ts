import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// DELETE /api/pending-orders/[key] — tombstone the pending order so it stays
// hidden even if Make.com re-fires the same phone (which would otherwise
// re-insert via upsert).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  const { error } = await getAdmin()
    .from('pending_orders')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('key', params.key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/pending-orders/[key] — approve: create order in CRM + remove pending
export async function POST(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  const body = await req.json()

  const webhookRes = await fetch(`${req.nextUrl.origin}/api/webhooks/new-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.WEBHOOK_SECRET!,
    },
    body: JSON.stringify(body),
  })

  if (!webhookRes.ok) {
    const err = await webhookRes.json().catch(() => ({}))
    return NextResponse.json({ error: err.error || 'Failed to create order' }, { status: 400 })
  }

  await getAdmin()
    .from('pending_orders')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('key', params.key)

  const order = await webhookRes.json()
  return NextResponse.json(order, { status: 201 })
}
