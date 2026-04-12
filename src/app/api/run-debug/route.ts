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
      // Test shipment creation with dummy data (uses _details to avoid actually creating)
      // _details returns a table showing how params were received - doesn't create the shipment
      const args = [
        n(CUSTOMER_NUM), a('מסירה'), n(), n(), a('MEZU'), a(),
        n(), n(), n(), n(),
        a('לקוח בדיקה'),  // P11 name
        a(),
        a('תל אביב'),     // P13 city
        a(),
        a('דיזנגוף'),     // P15 street
        a('1'),           // P16 building
        a(), a(), a(),
        a('0500000000'),  // P20 phone
        a(), a('TEST-DEBUG'), n(1),
        a(), a(), a(), a(), a(),
        n(), n(), n(), a(), a(), n(), n(),
        a('XML'), a('N'), a(), n(),
        a('test@test.com'), a(), a(),
      ].join(',')

      // Use _details mode - shows params without creating a shipment
      const url = `${base}?APPNAME=run&PRGNAME=ship_create_anonymous_details&ARGUMENTS=${encodeURIComponent(args)}`
      const res  = await fetch(url, {
        headers: AUTH_TOKEN ? { Authorization: `Token ${AUTH_TOKEN}` } : {},
      })
      const text = await res.text()
      return NextResponse.json({
        ok:      res.ok,
        status:  res.status,
        headers: Object.fromEntries(res.headers.entries()),
        preview: text.slice(0, 1000),
      })
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
