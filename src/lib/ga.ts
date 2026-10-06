// ─── Google Analytics 4 Data API (server only) ──────────────────────
//
// Auth: service account with Viewer access on the GA property. We sign the
// OAuth JWT ourselves (RS256 via node:crypto) to avoid pulling in the gRPC
// client. Tokens are cached in-process until a minute before expiry.
//
// Env:
//   GA_SERVICE_ACCOUNT_JSON — the service account key JSON (whole file)
//   GA_PROPERTY_ID          — numeric GA4 property id

import { createSign } from 'crypto'

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
let cached: { token: string; exp: number } | null = null

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

export function gaConfigured(): boolean {
  return !!(process.env.GA_SERVICE_ACCOUNT_JSON && process.env.GA_PROPERTY_ID)
}

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const key = JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON!)
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: key.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!res.ok) throw new Error(`GA auth ${res.status}: ${await res.text()}`)
  const j = await res.json()
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return cached.token
}

export interface GARow { dims: string[]; mets: number[] }

// Thin runReport wrapper: returns rows as plain dimension strings + numbers.
export async function runReport(body: Record<string, any>): Promise<GARow[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROPERTY_ID}:runReport`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      cache:   'no-store',
    },
  )
  if (!res.ok) throw new Error(`GA report ${res.status}: ${await res.text()}`)
  const j = await res.json()
  return (j.rows ?? []).map((r: any) => ({
    dims: (r.dimensionValues ?? []).map((d: any) => d.value),
    mets: (r.metricValues ?? []).map((m: any) => Number(m.value) || 0),
  }))
}
