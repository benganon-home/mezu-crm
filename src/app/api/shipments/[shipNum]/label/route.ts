import { buildLabelUrl } from '@/lib/run'

// GET /api/shipments/[shipNum]/label
// Proxies the PDF label from Run so the HOST isn't exposed client-side

export async function GET(_req: Request, { params }: { params: { shipNum: string } }) {
  try {
    const url = buildLabelUrl(params.shipNum)
    const res = await fetch(url)

    if (!res.ok) {
      return new Response(`Run label error ${res.status}`, { status: 502 })
    }

    const pdf = await res.arrayBuffer()
    return new Response(pdf, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="label-${params.shipNum}.pdf"`,
      },
    })
  } catch (err: any) {
    return new Response(err.message, { status: 500 })
  }
}
