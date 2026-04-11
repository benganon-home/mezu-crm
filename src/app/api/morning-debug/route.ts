import { NextResponse } from 'next/server'
import { searchInvoicesByPhone } from '@/lib/morning'

// GET /api/morning-debug?phone=05XXXXXXXX
export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get('phone') || '0508642482'
  try {
    const invoices = await searchInvoicesByPhone(phone)
    return NextResponse.json({
      count: invoices.length,
      invoices: invoices.map(inv => ({
        id:           inv.id,
        number:       inv.number,
        amount:       inv.amount,
        documentDate: inv.documentDate,
        clientName:   inv.client?.name,
        clientPhone:  inv.client?.phone,
        urlHe:        inv.url?.he,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
