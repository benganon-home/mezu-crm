import { NextResponse } from 'next/server'
import { searchInvoicesByPhone } from '@/lib/morning'

// GET /api/morning-debug?phone=05XXXXXXXX  — test invoice search
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone') || '0500000000'

  try {
    const invoices = await searchInvoicesByPhone(phone)
    // Return first invoice's full structure so we know all field names
    return NextResponse.json({
      count: invoices.length,
      firstInvoice: invoices[0] || null,
      allIds: invoices.map((i: any) => ({ id: i.id, number: i.number, sum: i.sum, url: i.url, date: i.date, clientName: i.client?.name })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
