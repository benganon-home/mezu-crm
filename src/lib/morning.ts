/**
 * Morning.co (חשבונית ירוקה) API client
 * Docs: https://morning.co/api/v1
 */

const BASE = 'https://api.morning.co/v1'

function authHeader() {
  const token = Buffer.from(
    `${process.env.MORNING_API_KEY}:${process.env.MORNING_API_SECRET}`
  ).toString('base64')
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' }
}

export interface MorningItem {
  description: string
  quantity:    number
  price:       number
  vatType?:    number  // 1 = included, 0 = excluded
}

export interface CreateInvoiceParams {
  customerName:  string
  customerPhone?: string
  items:         MorningItem[]
  sendEmail?:    boolean
  emailAddress?: string
}

export async function createInvoice(params: CreateInvoiceParams) {
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
    headers: authHeader(),
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Morning API error ${res.status}`)
  }

  return res.json() // { id, url, ... }
}

export async function getInvoice(invoiceId: string) {
  const res = await fetch(`${BASE}/documents/${invoiceId}`, {
    headers: authHeader(),
  })
  if (!res.ok) throw new Error(`Morning API error ${res.status}`)
  return res.json()
}
