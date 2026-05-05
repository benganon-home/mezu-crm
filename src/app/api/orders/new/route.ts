import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applySalesRules } from '@/lib/sales-rules'
import type { SalesRule } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { customer: customerData, order: orderData, items, total_price_override, total_price_locked } = await req.json()

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

  // 2. Apply sales rules server-side. Defense against three failure modes:
  //    a) Client cached rules from before someone toggled is_active off in settings
  //    b) Client never sent total_price_override (older client, or manual override skipped)
  //    c) Future endpoints/integrations posting straight to /api/orders/new
  // The user's manual override (total_price_locked=true) always wins — preserves
  // the "I just want this exact total" escape hatch on the drawer.
  const itemsForRules = (items || []).map((i: any) => ({
    model: i.model || null,
    size:  i.size  || null,
    price: Number(i.price) || 0,
  }))

  const { data: rulesData } = await supabase
    .from('sales_rules')
    .select('*')
    .eq('is_active', true)

  const ruleResult = applySalesRules(itemsForRules, (rulesData ?? []) as SalesRule[])

  // Distribute discount-adjusted prices back onto the original items (parallel arrays).
  // applySalesRules mutated `itemsForRules` in place when a rule matched.
  const adjustedItems = (items || []).map((i: any, idx: number) => ({
    ...i,
    price: ruleResult.appliedRule ? itemsForRules[idx].price : (Number(i.price) || 0),
  }))

  // Total: manual override (locked) > server-applied rule > raw sum
  let totalPrice: number
  if (total_price_locked && total_price_override != null) {
    totalPrice = Number(total_price_override)
  } else if (ruleResult.appliedRule) {
    totalPrice = ruleResult.finalTotal
  } else if (total_price_override != null) {
    totalPrice = Number(total_price_override)
  } else {
    totalPrice = ruleResult.autoTotal
  }

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
      total_price_locked: !!total_price_locked,
      source:           'manual',
    })
    .select('id')
    .single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 })

  // 4. Create items (with rule-adjusted prices when applicable)
  if (adjustedItems.length > 0) {
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(
        adjustedItems.map((i: any) => ({
          order_id:   order.id,
          product_id: i.product_id || null,
          item_name:  i.item_name || 'פריט',
          model:      i.model    || null,
          color:      i.color    || null,
          sign_text:  i.sign_text || null,
          font:       i.font     || null,
          size:       i.size     || null,
          price:      Number(i.price) || 0,
          status:     'received',
        }))
      )
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })
  }

  // 5. Return full order
  const { data: fullOrder, error: fetchErr } = await supabase
    .from('orders')
    .select('*, customer:customers(*), items:order_items(*, product:products(images))')
    .eq('id', order.id)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  return NextResponse.json(fullOrder, { status: 201 })
}
