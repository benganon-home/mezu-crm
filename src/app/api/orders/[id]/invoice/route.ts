import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createInvoice, searchInvoicesByPhone } from '@/lib/morning'

// GET /api/orders/[id]/invoice — search Morning for invoices matching this order's customer
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select('customer:customers(phone, name)')
    .eq('id', params.id)
    .single()

  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const phone = (order.customer as any)?.phone
  if (!phone) return NextResponse.json({ error: 'Customer has no phone' }, { status: 400 })

  try {
    const invoices = await searchInvoicesByPhone(phone)
    return NextResponse.json({ invoices })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/orders/[id]/invoice — link an existing Morning invoice to this order
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { invoice_id, invoice_url } = await req.json()
  const { error } = await supabase
    .from('orders')
    .update({ invoice_id: String(invoice_id), invoice_url: invoice_url || '' })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, invoice_id, invoice_url })
}

// POST /api/orders/[id]/invoice — create Morning invoice for an order
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // Fetch order with customer + items
  const { data: order, error } = await supabase
    .from('orders')
    .select(`*, customer:customers(id, name, phone, email), items:order_items(*)`)
    .eq('id', params.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: error?.message || 'Order not found' }, { status: 404 })
  }

  if (order.invoice_id) {
    return NextResponse.json({ error: 'Invoice already exists', invoice_id: order.invoice_id, invoice_url: order.invoice_url }, { status: 409 })
  }

  const items = order.items || []
  if (items.length === 0) {
    return NextResponse.json({ error: 'Order has no items' }, { status: 400 })
  }

  try {
    const result = await createInvoice({
      customerName:  order.customer?.name || 'לקוח',
      customerPhone: order.customer?.phone || undefined,
      emailAddress:  order.customer?.email || undefined,
      sendEmail:     !!order.customer?.email,
      items: items.map((i: any) => ({
        description: [i.item_name, i.size && `${i.size} ס"מ`, i.color, i.sign_text].filter(Boolean).join(' — '),
        quantity:    1,
        price:       Number(i.price) || 0,
        vatType:     1,
      })),
    })

    // Save invoice_id + invoice_url back to the order
    const invoiceId  = String(result.id || result.invoiceId || result.document_id || '')
    const invoiceUrl = result.url || result.invoiceUrl || result.document_url || ''

    await supabase
      .from('orders')
      .update({ invoice_id: invoiceId, invoice_url: invoiceUrl })
      .eq('id', params.id)

    return NextResponse.json({ invoice_id: invoiceId, invoice_url: invoiceUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create invoice' }, { status: 500 })
  }
}
