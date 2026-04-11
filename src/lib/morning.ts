/**
 * Morning.co (חשבונית ירוקה) API client
 *
 * Base URL : https://api.greeninvoice.co.il/api/v1
 * Auth     : POST /account/token  { id, secret } → { token: JWT }
 *            then:  Authorization: Bearer <token>
 */

const BASE = 'https://api.greeninvoice.co.il/api/v1'

async function getToken(): Promise<string> {
  const id     = process.env.MORNING_API_KEY
  const secret = process.env.MORNING_API_SECRET
  if (!id || !secret) throw new Error('MORNING_API_KEY / MORNING_API_SECRET not set')

  const res = await fetch(`${BASE}/account/token`, {
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

export interface MorningItem {
  description: string
  quantity:    number
  price:       number
  vatType?:    number  // 1 = included, 0 = excluded
}

export interface CreateInvoiceParams {
  customerName:   string
  customerPhone?: string
  items:          MorningItem[]
  sendEmail?:     boolean
  emailAddress?:  string
}

// ── Create invoice ─────────────────────────────────────────────

export async function createInvoice(params: CreateInvoiceParams) {
  const token = await getToken()

  const body = {
    type:     320, // חשבונית מס קבלה
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

// ── Search invoices by customer phone ─────────────────────────

export async function searchInvoicesByPhone(phone: string) {
  const token   = await getToken()
  const digits  = phone.replace(/\D/g, '')
  const local   = digits.startsWith('0') ? digits : '0' + digits.replace(/^972/, '')
  const intl    = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '')

  const trySearch = async (clientPhone: string): Promise<any[]> => {
    const qs  = new URLSearchParams({ type: '320', pageSize: '20', page: '1', 'client.phone': clientPhone })
    const res = await fetch(`${BASE}/documents?${qs}`, { headers: bearer(token) })
    const d   = await res.json()
    if (!res.ok) throw new Error(`Morning search (${res.status}): ${d.errorMessage || JSON.stringify(d)}`)
    return d.items || d.documents || d.data || []
  }

  // Try local format first (05x), then international (972x)
  const r1 = await trySearch(local)
  if (r1.length > 0) return r1
  return trySearch(intl)
}

// ── Get single invoice ─────────────────────────────────────────

export async function getInvoice(invoiceId: string) {
  const token = await getToken()
  const res   = await fetch(`${BASE}/documents/${invoiceId}`, { headers: bearer(token) })
  const data  = await res.json()
  if (!res.ok) throw new Error(`Morning getInvoice (${res.status}): ${data.errorMessage || JSON.stringify(data)}`)
  return data
}
