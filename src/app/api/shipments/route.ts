import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { createShipment } from '@/lib/run'
import { normalizeAddress, validateAddress, formatAddress, orderAddressColumns } from '@/lib/address'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (key) return createClient(url, key)
  return createServerClient()
}

// POST /api/shipments
// Body: { order_id, city, street, building, entrance?, floor?, apartment?, shipping_notes? }
// The address the label was created with is saved back to the order.

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { order_id, shipping_notes } = body
    if (!order_id) return NextResponse.json({ error: 'order_id חסר' }, { status: 400 })
    const addr = normalizeAddress(body)
    const addrErr = validateAddress(addr)
    if (addrErr) return NextResponse.json({ error: addrErr }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, customers(name, phone, email)')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 })
    }

    const customer = order.customers as any

    const shipment = await createShipment({
      name:      customer?.name || 'לקוח',
      city:      addr.city,
      street:    addr.street,
      building:  addr.building,
      entrance:  addr.entrance  || '',
      floor:     addr.floor     || '',
      apartment: addr.apartment || '',
      phone:     customer?.phone || '',
      email:     customer?.email || '',
      reference: order_id,
      remarks:   shipping_notes || '',
    })

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        tracking_number:  shipment.shipNum,
        delivery_address: formatAddress(addr),
        ...orderAddressColumns(addr),
      })
      .eq('id', order_id)

    if (updateErr) {
      return NextResponse.json({ error: `משלוח נוצר אך שמירת מספר מעקב נכשלה: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ shipNum: shipment.shipNum, randId: shipment.randId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
