/**
 * Morning.co (חשבונית ירוקה) API client
 * Auth flow: POST /account/token with Basic auth → get JWT → use as Bearer
 */

const BASE = 'https://api.green-invoice.co.il/v1'

async function getToken(): Promise<string> {
  const basic = Buffer.from(
    `${process.env.MORNING_API_KEY}:${process.env.MORNING_API_SECRET}`
  ).toString('base64')

  const res = await fetch(`${BASE}/account/token`, {
    method:  'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Morning auth error ${res.status}`)
  }

  const data = await res.json()
  return data.token
}

function bearerHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

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

export async function createInvoice(params: CreateInvoiceParams) {
  const token = await getToken()

  const body = {
    type: 320, // חשבונית מס קבלה
    lang: 'he',
    currency: 'ILS',
    vatType: 1, // prices include VAT
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

  const res = await fetch(`${BASE}/documents`, {
    method:  'POST',
    headers: bearerHeader(token),
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Morning API error ${res.status}`)
  }

  return res.json() // { id, url, ... }
}

export async function getInvoice(invoiceId: string) {
  const token = await getToken()
  const res   = await fetch(`${BASE}/documents/${invoiceId}`, {
    headers: bearerHeader(token),
  })
  if (!res.ok) throw new Error(`Morning API error ${res.status}`)
  return res.json()
}
