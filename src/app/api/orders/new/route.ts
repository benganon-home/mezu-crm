import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { customer: customerData, order: orderData, items } = await req.json()

  // Normalize phone to 0XX format
  const cleanPhone = customerData.phone.replace(/\D/g, '')
  const phone = cleanPhone.startsWith('972') ? '0' + cleanPhone.slice(3) : cleanPhone

  // 1. Find existing customer by phone
  const { data: existing } = await supabase
    .from('customers')
    .select('id, name, address')
    .eq('phone', phone)
    .maybeSingle()

  let customerId: string

  if (existing) {
    customerId = existing.id
    // Update address if we have one and they didn't
    if (customerData.address && !existing.address) {
      await supabase.from('customers').update({ address: customerData.address }).eq('id', customerId)
    }
  } else {
    const { data: newCustomer, error: custErr } = await supabase
      .from('customers')
      .insert({ name: customerData.name, phone, address: customerData.address || null })
      .select('id')
      .single()
    if (custErr) return NextResponse.json({ error: custErr.message }, { status: 400 })
    customerId = newCustomer.id
  }

  // 2. Total price from items
  const totalPrice = (items || []).reduce((s: number, i: any) => s + (Number(i.price) || 0), 0)

  // 3. Create order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id:      customerId,
      status:           'received',
      delivery_type:    orderData.delivery_type,
      delivery_address: orderData.delivery_type === 'delivery' ? (orderData.delivery_address || null) : null,
      notes:            orderData.notes || null,
      total_price:      totalPrice,
      source:           'manual',
    })
    .select('id')
    .single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 })

  // 4. Create items
  if (items && items.length > 0) {
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(
        items.map((i: any) => ({
          order_id:  order.id,
          item_name: i.item_name || 'פריט',
          model:     i.model    || null,
          color:     i.color    || null,
          sign_text: i.sign_text || null,
          font:      i.font     || null,
          size:      i.size     || null,
          price:     Number(i.price) || 0,
          status:    'received',
        }))
      )
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })
  }

  // 5. Return full order
  const { data: fullOrder, error: fetchErr } = await supabase
    .from('orders')
    .select('*, customer:customers(*), items:order_items(*)')
    .eq('id', order.id)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  return NextResponse.json(fullOrder, { status: 201 })
}
