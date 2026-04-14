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
// Merges all K-Express label PDFs for orders in 'ready' status with a tracking number
export async function GET() {
  const supabase = getSupabaseAdmin()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, tracking_number')
    .eq('status', 'ready')
    .not('tracking_number', 'is', null)
    .neq('tracking_number', '')
    .neq('tracking_number', '0')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!orders?.length) return NextResponse.json({ error: 'אין הזמנות מוכנות עם תוויות' }, { status: 404 })

  const merged  = await PDFDocument.create()
  const failed: string[] = []

  for (const order of orders) {
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
      error: 'לא ניתן לטעון תוויות',
      details: failed,
      ordersFound: orders.length,
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
