import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createShipment, parseAddress } from '@/lib/run'

// POST /api/shipments
// Body: { order_id }
// Creates a Run shipment from order data and saves the tracking number

export async function POST(req: Request) {
  try {
    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: 'order_id חסר' }, { status: 400 })

    const supabase = createServerClient()

    // Fetch order + customer
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, customers(name, phone, email)')
      .eq('id', order_id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 })
    }

    const customer = order.customers as any
    const address  = parseAddress(order.delivery_address || customer?.address || '')

    const shipment = await createShipment({
      name:      customer?.name || 'לקוח',
      city:      address.city,
      street:    address.street,
      building:  address.building,
      phone:     customer?.phone || '',
      email:     customer?.email || '',
      reference: order_id,
      remarks:   order.notes || '',
    })

    // Save tracking number + auto-update status to shipped
    await supabase
      .from('orders')
      .update({
        tracking_number: shipment.shipNum,
        status:          'shipped',
      })
      .eq('id', order_id)

    return NextResponse.json({ shipNum: shipment.shipNum, randId: shipment.randId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
