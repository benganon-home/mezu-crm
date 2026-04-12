import { NextResponse } from 'next/server'

// GET /api/run-debug — tests raw connectivity to the Run API
export async function GET() {
  const host = process.env.RUN_HOST || ''
  const url  = `https://${host}/RunCom.Server/Request.aspx?APPNAME=run&PRGNAME=ws_spotslist&ARGUMENTS=-Aall`

  try {
    const res  = await fetch(url)
    const text = await res.text()
    return NextResponse.json({ ok: res.ok, status: res.status, preview: text.slice(0, 500) })
  } catch (err: any) {
    return NextResponse.json({
      error:   err.message,
      cause:   String(err.cause ?? ''),
      code:    err.cause?.code ?? '',
      url,
    })
  }
}
