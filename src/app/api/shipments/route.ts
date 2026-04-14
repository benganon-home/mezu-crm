import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { createShipment } from '@/lib/run'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (key) return createClient(url, key)
  return createServerClient()
}

// POST /api/shipments
// Body: { order_id, city, street, building?, floor?, apartment? }

export async function POST(req: Request) {
  try {
    const { order_id, city, street, building, floor, apartment } = await req.json()
    if (!order_id) return NextResponse.json({ error: 'order_id חסר' }, { status: 400 })
    if (!city || !street) return NextResponse.json({ error: 'עיר ורחוב הם שדות חובה' }, { status: 400 })

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
      city,
      street,
      building:  building  || '',
      floor:     floor     || '',
      apartment: apartment || '',
      phone:     customer?.phone || '',
      email:     customer?.email || '',
      reference: order_id,
      remarks:   order.notes   || '',
    })

    const { error: updateErr } = await supabase
      .from('orders')
      .update({ tracking_number: shipment.shipNum })
      .eq('id', order_id)

    if (updateErr) {
      return NextResponse.json({ error: `משלוח נוצר אך שמירת מספר מעקב נכשלה: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ shipNum: shipment.shipNum, randId: shipment.randId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
