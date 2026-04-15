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

  // A4 layout: fixed 2 cols × 3 rows = 6 labels per page
  const A4_W      = 595.28
  const A4_H      = 841.89
  const MARGIN    = 6
  const COLS      = 2
  const ROWS      = 3
  const PER_PAGE  = COLS * ROWS

  // Measure actual label size from first page
  const firstPage = labelPages[0].doc.getPage(labelPages[0].pageIndex)
  const labelNatW = firstPage.getWidth()
  const labelNatH = firstPage.getHeight()

  // Cell box = whatever's left after margins between + around
  const cellW = (A4_W - MARGIN * (COLS + 1)) / COLS
  const cellH = (A4_H - MARGIN * (ROWS + 1)) / ROWS

  // Scale so label fits inside cell — respect BOTH dimensions
  const scale   = Math.min(cellW / labelNatW, cellH / labelNatH)
  const scaledW = labelNatW * scale
  const scaledH = labelNatH * scale

  const merged = await PDFDocument.create()

  for (let i = 0; i < labelPages.length; i += PER_PAGE) {
    const a4    = merged.addPage([A4_W, A4_H])
    const batch = labelPages.slice(i, i + PER_PAGE)

    for (let j = 0; j < batch.length; j++) {
      const { doc, pageIndex } = batch[j]
      const [embedded] = await merged.embedPages([doc.getPage(pageIndex)])

      const col = j % COLS
      const row = Math.floor(j / COLS)

      // Cell top-left corner (in PDF coords, y=0 is bottom)
      const cellX = MARGIN + col * (cellW + MARGIN)
      const cellY = A4_H - MARGIN - (row + 1) * cellH - row * MARGIN

      // Center label inside cell
      const x = cellX + (cellW - scaledW) / 2
      const y = cellY + (cellH - scaledH) / 2

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
