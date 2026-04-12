import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildLabelUrl } from '@/lib/run'
import { PDFDocument } from 'pdf-lib'

// GET /api/labels/ready
// Merges all K-Express label PDFs for orders in 'ready' status with a tracking number
export async function GET() {
  const supabase = createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, tracking_number')
    .eq('status', 'ready')
    .not('tracking_number', 'is', null)
    .neq('tracking_number', '')
    .neq('tracking_number', '0')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!orders?.length) return NextResponse.json({ error: 'אין הזמנות מוכנות עם תוויות' }, { status: 404 })

  const merged = await PDFDocument.create()

  for (const order of orders) {
    try {
      const url = buildLabelUrl(order.tracking_number!)
      const res = await fetch(url)
      if (!res.ok) continue
      const bytes = await res.arrayBuffer()
      const pdf   = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(pdf, pdf.getPageIndices())
      pages.forEach(p => merged.addPage(p))
    } catch {
      // Skip labels that fail — don't block the whole batch
    }
  }

  if (merged.getPageCount() === 0) {
    return NextResponse.json({ error: 'לא ניתן לטעון תוויות' }, { status: 500 })
  }

  const pdfBytes = await merged.save()

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="labels-${new Date().toISOString().slice(0,10)}.pdf"`,
    },
  })
}
