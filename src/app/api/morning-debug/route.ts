import { NextResponse } from 'next/server'
import { searchInvoicesByName } from '@/lib/morning'

// GET /api/morning-debug?name=שם+לקוח
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') || ''
  try {
    const invoices = await searchInvoicesByName(name)
    return NextResponse.json({
      count: invoices.length,
      invoices: invoices.map(inv => ({
        id:           inv.id,
        number:       inv.number,
        amount:       inv.amount,
        documentDate: inv.documentDate,
        clientName:   inv.client?.name,
        urlHe:        inv.url?.he?.slice(0, 80) + '...',
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
