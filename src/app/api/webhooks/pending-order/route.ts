import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret') || ''
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const cleanPhone = (body.phone || '').replace(/\D/g, '').replace(/^972/, '0')
  const key = cleanPhone || randomUUID()

  const { error } = await getAdmin()
    .from('pending_orders')
    .upsert({
      key,
      data: {
        phone:          cleanPhone,
        customer_name:  body.customer_name  || null,
        address:        body.address        || null,
        sign_text:      body.sign_text      || null,
        mishpachat:     body.mishpachat     || null,
        font:           body.font           || null,
        sign_type:      body.sign_type      || null,
        color:          body.color          || null,
        mezuzah_model:  body.mezuzah_model  || null,
        mezuzah_size:   body.mezuzah_size   || null,
        extra_qty:      body.extra_qty      || null,
        extra_model:    body.extra_model    || null,
        total_price:    body.total_price    || null,
      },
    }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
