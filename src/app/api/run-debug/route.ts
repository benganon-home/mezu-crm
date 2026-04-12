import { NextResponse } from 'next/server'

const HOST         = (process.env.RUN_HOST || '').trim()
const CUSTOMER_NUM = (process.env.RUN_CUSTOMER_NUMBER || '').trim()
const AUTH_TOKEN   = (process.env.RUN_AUTH_TOKEN || '').trim()

function n(val?: string | number) { return `-N${val ?? ''}` }
function a(val?: string)          { return `-A${val ?? ''}` }

// GET /api/run-debug?mode=connect|ship|auth
export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get('mode') || 'connect'

  const base = `https://${HOST}/RunCom.Server/Request.aspx`

  try {
    if (mode === 'connect') {
      // Test basic connectivity - get pickup points list
      const url = `${base}?APPNAME=run&PRGNAME=ws_spotslist&ARGUMENTS=${encodeURIComponent('-Aall')}`
      const res  = await fetch(url)
      const text = await res.text()
      return NextResponse.json({ ok: res.ok, status: res.status, preview: text.slice(0, 300) })
    }

    if (mode === 'ship') {
      // Try different shipment type + cargo type code combos to find the right ones
      const shipType  = new URL(req.url).searchParams.get('p3') || '1'
      const cargoType = new URL(req.url).searchParams.get('p7') || '1'

      const args = [
        n(CUSTOMER_NUM), a('מסירה'), n(shipType), n(), a('MEZU'), a(),
        n(cargoType), n(), n(), n(),
        a('לקוח בדיקה'),
        a(), a('תל אביב'), a(), a('דיזנגוף'), a('1'),
        a(), a(), a(),
        a('0500000000'),
        a(), a('DEBUG-TEST'), n(1),
        a(), a(), a(), a(), a(),
        n(), n(), n(), a(), a(), n(), n(),
        a('XML'), a('N'), a(), n(),
        a(), a(), a(),
      ].join(',')

      const url = `${base}?APPNAME=run&PRGNAME=ship_create_anonymous&ARGUMENTS=${encodeURIComponent(args)}`
      const res  = await fetch(url)
      const text = await res.text()
      return NextResponse.json({ ok: res.ok, status: res.status, p3: shipType, p7: cargoType, raw: text })
    }

    if (mode === 'auth') {
      // Test with no auth header to see if auth is required
      const url  = `${base}?APPNAME=run&PRGNAME=ws_spotslist&ARGUMENTS=${encodeURIComponent('-Aתל אביב')}`
      const res  = await fetch(url)
      const text = await res.text()
      return NextResponse.json({ ok: res.ok, status: res.status, preview: text.slice(0, 300) })
    }

    return NextResponse.json({ error: 'mode must be connect|ship|auth' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, cause: String(err.cause ?? ''), code: err.cause?.code ?? '' })
  }
}
