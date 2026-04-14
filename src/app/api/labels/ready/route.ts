import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { buildLabelUrl } from '@/lib/run'
import { PDFDocument } from 'pdf-lib'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (key) return createClient(url, key)
  return createServerClient()
}

// GET /api/labels/ready
// Prints labels for orders where ALL items have status='ready' AND tracking_number is set
// ("מוכן לשליחה" — same logic as the orders page stat card)
export async function GET() {
  const supabase = getSupabaseAdmin()

  // Fetch all orders with their items and tracking number
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, tracking_number, items:order_items(status)')
    .not('tracking_number', 'is', null)
    .neq('tracking_number', '')
    .neq('tracking_number', '0')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep only orders where every item has status='ready'
  const readyOrders = (orders || []).filter(o =>
    (o.items || []).length > 0 &&
    (o.items as any[]).every(i => i.status === 'ready')
  )

  if (!readyOrders.length) {
    return NextResponse.json({ error: 'אין הזמנות מוכנות לשליחה עם תוויות' }, { status: 404 })
  }

  const merged = await PDFDocument.create()
  const failed: string[] = []

  for (const order of readyOrders) {
    try {
      const url = buildLabelUrl(order.tracking_number!)
      const res = await fetch(url)
      if (!res.ok) {
        failed.push(`${order.tracking_number} (HTTP ${res.status})`)
        continue
      }
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf')) {
        failed.push(`${order.tracking_number} (not a PDF: ${contentType})`)
        continue
      }
      const bytes = await res.arrayBuffer()
      const pdf   = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(pdf, pdf.getPageIndices())
      pages.forEach(p => merged.addPage(p))
    } catch (e: any) {
      failed.push(`${order.tracking_number} (${e.message})`)
    }
  }

  if (merged.getPageCount() === 0) {
    return NextResponse.json({
      error:       'לא ניתן לטעון תוויות',
      details:     failed,
      ordersFound: readyOrders.length,
    }, { status: 500 })
  }

  const pdfBytes = await merged.save()

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="labels-${new Date().toISOString().slice(0,10)}.pdf"`,
    },
  })
}
