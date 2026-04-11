/**
 * Morning.co (חשבונית ירוקה) API client
 *
 * Base URL : https://api.greeninvoice.co.il/api/v1
 * Auth     : POST /account/token  { id, secret } → { token: JWT }
 *            then:  Authorization: Bearer <token>
 * Search   : POST /documents/search  { pageSize, page, client: { phone } }
 * Doc URL  : response.url.he  (Hebrew PDF link)
 */

const BASE = 'https://api.greeninvoice.co.il/api/v1'

export async function getToken(): Promise<string> {
  const id     = process.env.MORNING_API_KEY
  const secret = process.env.MORNING_API_SECRET
  if (!id || !secret) throw new Error('MORNING_API_KEY / MORNING_API_SECRET not configured')

  const res  = await fetch(`${BASE}/account/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id, secret }),
  })
  const data = await res.json()
  if (!res.ok || !data.token) {
    throw new Error(`Morning auth failed (${res.status}): ${data.errorMessage || JSON.stringify(data)}`)
  }
  return data.token
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// ── Types ──────────────────────────────────────────────────────

export interface MorningDocument {
  id:           string
  number:       string
  type:         number
  documentDate: string    // 'YYYY-MM-DD'
  amount:       number    // total incl. VAT
  url: {
    he:     string        // Hebrew PDF download link
    en:     string
    origin: string
  }
  client: {
    name:   string
    phone?: string
    mobile?: string
  }
  status: number
}

export interface MorningItem {
  description: string
  quantity:    number
  price:       number
  vatType?:    number
}

export interface CreateInvoiceParams {
  customerName:   string
  customerPhone?: string
  items:          MorningItem[]
  sendEmail?:     boolean
  emailAddress?:  string
}

// ── Search invoices by customer phone ─────────────────────────

async function doSearch(token: string, body: Record<string, any>): Promise<MorningDocument[]> {
  const res  = await fetch(`${BASE}/documents/search`, {
    method:  'POST',
    headers: bearer(token),
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Morning search (${res.status}): ${data.errorMessage || JSON.stringify(data)}`)
  return data.items || []
}

export async function searchInvoicesByName(name: string): Promise<MorningDocument[]> {
  const token = await getToken()

  // Try exact name, then first word of name, then all recent
  const byName = await doSearch(token, { pageSize: 20, page: 1, client: { name } })
  if (byName.length > 0) return byName

  const firstName = name.split(' ')[0]
  if (firstName && firstName !== name) {
    const byFirst = await doSearch(token, { pageSize: 20, page: 1, client: { name: firstName } })
    if (byFirst.length > 0) return byFirst
  }

  // Fallback: return 20 most recent documents
  return doSearch(token, { pageSize: 20, page: 1 })
}

// ── Create invoice ─────────────────────────────────────────────

export async function createInvoice(params: CreateInvoiceParams) {
  const token = await getToken()

  const body = {
    type:     320,
    lang:     'he',
    currency: 'ILS',
    vatType:  1,
    client: {
      name:  params.customerName,
      phone: params.customerPhone || '',
    },
    income: params.items.map(i => ({
      description: i.description,
      quantity:    i.quantity,
      price:       i.price,
      vatType:     i.vatType ?? 1,
    })),
    ...(params.sendEmail && params.emailAddress
      ? { sendByEmail: true, emailAddress: params.emailAddress }
      : {}),
  }

  const res  = await fetch(`${BASE}/documents`, {
    method:  'POST',
    headers: bearer(token),
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Morning createInvoice (${res.status}): ${data.errorMessage || JSON.stringify(data)}`)
  return data
}

// ── Get single invoice ─────────────────────────────────────────

export async function getInvoice(invoiceId: string): Promise<MorningDocument> {
  const token = await getToken()
  const res   = await fetch(`${BASE}/documents/${invoiceId}`, { headers: bearer(token) })
  const data  = await res.json()
  if (!res.ok) throw new Error(`Morning getInvoice (${res.status}): ${data.errorMessage || JSON.stringify(data)}`)
  return data
}
