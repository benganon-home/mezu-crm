import { NextResponse } from 'next/server'
import { createHmac, createHash } from 'crypto'

const KEY    = process.env.MORNING_API_KEY    || ''
const SECRET = process.env.MORNING_API_SECRET || ''
const BASE   = 'https://api.greeninvoice.co.il/api/v1'

// ── AWS SigV4 signer ──────────────────────────────────────────
function sha256hex(data: string) {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}
function sigV4Headers(opts: {
  method: string; url: string; body: string
  accessKey: string; secretKey: string; region: string
}): Record<string, string> {
  const { method, body, accessKey, secretKey, region } = opts
  const service = 'execute-api'
  const parsed  = new URL(opts.url)
  const now     = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date    = amzDate.slice(0, 8)
  const host    = parsed.hostname
  const path    = parsed.pathname
  const qs      = parsed.search.slice(1)

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders    = 'content-type;host;x-amz-date'
  const payloadHash      = sha256hex(body)

  const canonicalReq = [method.toUpperCase(), path, qs, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const credScope    = `${date}/${region}/${service}/aws4_request`
  const strToSign    = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${sha256hex(canonicalReq)}`

  const kDate = hmac('AWS4' + secretKey, date)
  const kReg  = hmac(kDate, region)
  const kSvc  = hmac(kReg, service)
  const kSign = hmac(kSvc, 'aws4_request')
  const sig   = createHmac('sha256', kSign).update(strToSign).digest('hex')

  return {
    'Content-Type':  'application/json',
    'X-Amz-Date':   amzDate,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  }
}

async function probe(label: string, url: string, init: RequestInit) {
  try {
    const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    const text = await res.text()
    return { label, status: res.status, body: text.slice(0, 400) }
  } catch (e: any) {
    return { label, error: e.message }
  }
}

export async function GET() {
  const tokenUrl = `${BASE}/account/token`
  const body     = JSON.stringify({ id: KEY, secret: SECRET })

  const results = await Promise.all([
    // SigV4 — POST /account/token — try 3 regions
    probe('sigv4/token/us-east-1', tokenUrl, {
      method: 'POST',
      headers: sigV4Headers({ method: 'POST', url: tokenUrl, body, accessKey: KEY, secretKey: SECRET, region: 'us-east-1' }),
      body,
    }),
    probe('sigv4/token/eu-west-1', tokenUrl, {
      method: 'POST',
      headers: sigV4Headers({ method: 'POST', url: tokenUrl, body, accessKey: KEY, secretKey: SECRET, region: 'eu-west-1' }),
      body,
    }),
    probe('sigv4/token/eu-central-1', tokenUrl, {
      method: 'POST',
      headers: sigV4Headers({ method: 'POST', url: tokenUrl, body, accessKey: KEY, secretKey: SECRET, region: 'eu-central-1' }),
      body,
    }),
    probe('sigv4/token/il-central-1', tokenUrl, {
      method: 'POST',
      headers: sigV4Headers({ method: 'POST', url: tokenUrl, body, accessKey: KEY, secretKey: SECRET, region: 'il-central-1' }),
      body,
    }),
  ])

  return NextResponse.json(results)
}
