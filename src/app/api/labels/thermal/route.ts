import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { buildLabelUrl } from '@/lib/run'
import { PDFDocument } from 'pdf-lib'

// Never pre-render at build time — this fetches live data per request.
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (key) return createClient(url, key)
  return createServerClient()
}

// GET /api/labels/thermal
// Returns ONE multi-page PDF where each page is a single label at native size
// (no A4 packing), for every order that has a tracking number and is NOT yet
// shipped/cancelled. Meant to be sent to the local thermal print agent, which
// prints each page as one 60x80 label.
export async function GET() {
  const supabase = getSupabaseAdmin()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, tracking_number, status')
    .not('tracking_number', 'is', null)
    .neq('tracking_number', '')
    .neq('tracking_number', '0')
    .not('status', 'in', '("shipped","cancelled")')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = orders || []
  if (!list.length) {
    return NextResponse.json({ error: 'אין הזמנות עם תוויות להדפסה' }, { status: 404 })
  }

  const merged = await PDFDocument.create()
  const failed: string[] = []

  for (const o of list) {
    try {
      const res = await fetch(buildLabelUrl(o.tracking_number!))
      if (!res.ok) { failed.push(`${o.tracking_number} (HTTP ${res.status})`); continue }
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('pdf')) { failed.push(`${o.tracking_number} (not PDF)`); continue }
      const bytes = await res.arrayBuffer()
      const src = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(src, src.getPageIndices())
      pages.forEach(p => merged.addPage(p))
    } catch (e: any) {
      failed.push(`${o.tracking_number} (${e.message})`)
    }
  }

  if (merged.getPageCount() === 0) {
    return NextResponse.json(
      { error: 'לא ניתן לטעון תוויות', details: failed, ordersFound: list.length },
      { status: 500 },
    )
  }

  const pdfBytes = await merged.save()
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="thermal-labels-${new Date().toISOString().slice(0, 10)}.pdf"`,
      'X-Label-Count': String(merged.getPageCount()),
    },
  })
}
