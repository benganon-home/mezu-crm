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

export async function searchInvoicesByPhone(phone: string): Promise<MorningDocument[]> {
  const token  = await getToken()
  const digits = phone.replace(/\D/g, '')
  const local  = digits.startsWith('0') ? digits : '0' + digits.replace(/^972/, '')

  // Try local format (05x), then try without phone filter to get recent docs
  const doSearch = async (clientPhone?: string): Promise<MorningDocument[]> => {
    const body: Record<string, any> = { pageSize: 20, page: 1 }
    if (clientPhone) body.client = { phone: clientPhone }

    const res  = await fetch(`${BASE}/documents/search`, {
      method:  'POST',
      headers: bearer(token),
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Morning search failed (${res.status}): ${data.errorMessage || JSON.stringify(data)}`)
    return data.items || []
  }

  // 1. Try local format with phone
  const byPhone = await doSearch(local)
  if (byPhone.length > 0) return byPhone

  // 2. Try international format
  const intl    = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '')
  const byIntl  = await doSearch(intl)
  if (byIntl.length > 0) return byIntl

  // 3. Fallback: return most recent 20 docs for the user to pick from
  return doSearch()
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
