import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchInvoicesByName } from '@/lib/morning'

// POST /api/orders/link-invoice
// Body: { order_id, customer_name }
// Searches Morning for a matching invoice and links it to the order.
// Returns: { linked: true, invoice } | { linked: false, candidates: [...] }
export async function POST(req: NextRequest) {
  const { order_id, customer_name } = await req.json()
  if (!order_id || !customer_name) {
    return NextResponse.json({ error: 'order_id ו-customer_name נדרשים' }, { status: 400 })
  }

  const invoices = await searchInvoicesByName(customer_name)

  if (invoices.length === 1) {
    const supabase = createClient()
    await supabase
      .from('orders')
      .update({
        invoice_id:  invoices[0].id,
        invoice_url: invoices[0].url?.he || invoices[0].url?.origin || null,
      })
      .eq('id', order_id)

    return NextResponse.json({ linked: true, invoice: invoices[0] })
  }

  // Multiple or zero — return candidates for manual selection
  return NextResponse.json({ linked: false, candidates: invoices })
}
