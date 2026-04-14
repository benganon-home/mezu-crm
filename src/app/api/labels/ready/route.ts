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

  // Collect all label pages from K-Express
  const labelPages: { doc: PDFDocument; pageIndex: number }[] = []
  const failed: string[] = []

  for (const order of readyOrders) {
    try {
      const url = buildLabelUrl(order.tracking_number!)
      const res = await fetch(url)
      if (!res.ok) { failed.push(`${order.tracking_number} (HTTP ${res.status})`); continue }
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf')) { failed.push(`${order.tracking_number} (not PDF)`); continue }
      const bytes = await res.arrayBuffer()
      const pdf   = await PDFDocument.load(bytes)
      for (let i = 0; i < pdf.getPageCount(); i++) {
        labelPages.push({ doc: pdf, pageIndex: i })
      }
    } catch (e: any) {
      failed.push(`${order.tracking_number} (${e.message})`)
    }
  }

  if (labelPages.length === 0) {
    return NextResponse.json({ error: 'לא ניתן לטעון תוויות', details: failed, ordersFound: readyOrders.length }, { status: 500 })
  }

  // Layout: 2 columns × 4 rows = 8 labels per A4 page
  const A4_W = 595.28
  const A4_H = 841.89
  const COLS = 2
  const ROWS = 4
  const PER_PAGE = COLS * ROWS
  const cellW = A4_W / COLS
  const cellH = A4_H / ROWS

  const merged = await PDFDocument.create()

  for (let i = 0; i < labelPages.length; i += PER_PAGE) {
    const a4 = merged.addPage([A4_W, A4_H])
    const batch = labelPages.slice(i, i + PER_PAGE)

    for (let j = 0; j < batch.length; j++) {
      const { doc, pageIndex } = batch[j]
      const [embedded] = await merged.embedPages([doc.getPage(pageIndex)])
      const { width, height } = embedded

      const scale  = Math.min(cellW / width, cellH / height)
      const scaledW = width  * scale
      const scaledH = height * scale
      const col = j % COLS
      const row = Math.floor(j / COLS)

      // PDF y=0 is bottom-left; rows go top→bottom
      const x = col * cellW + (cellW - scaledW) / 2
      const y = A4_H - (row + 1) * cellH + (cellH - scaledH) / 2

      a4.drawPage(embedded, { x, y, xScale: scale, yScale: scale })
    }
  }

  const pdfBytes = await merged.save()

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="labels-${new Date().toISOString().slice(0,10)}.pdf"`,
    },
  })
}
