/**
 * Morning.co (חשבונית ירוקה) API client
 *
 * Auth: POST /account/token with JSON body { id, secret } → JWT token
 * Then: Bearer token on all subsequent requests
 *
 * Docs: https://morning.co/developers
 */

const BASE = 'https://api.morning.co/v1'

export async function getToken(): Promise<string> {
  const id     = process.env.MORNING_API_KEY
  const secret = process.env.MORNING_API_SECRET

  if (!id || !secret) throw new Error('MORNING_API_KEY / MORNING_API_SECRET not set')

  const res = await fetch(`${BASE}/account/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id, secret }),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Morning token error ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = JSON.parse(text)
  const token = data.token || data.access_token || data.jwt
  if (!token) throw new Error(`Morning token missing in response: ${text.slice(0, 300)}`)
  return token
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
    vatType: 1,
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

  const text = await res.text()
  if (!res.ok) throw new Error(`Morning createInvoice ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

export async function searchInvoicesByPhone(phone: string) {
  const token = await getToken()

  // Try both 972-prefix and local 05x format
  const digits     = phone.replace(/\D/g, '')
  const intl       = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '')
  const local      = '0' + intl.slice(3)

  const trySearch = async (clientPhone: string) => {
    const qs = new URLSearchParams({ type: '320', pageSize: '20', page: '1', 'client.phone': clientPhone })
    const res = await fetch(`${BASE}/documents?${qs}`, { headers: bearerHeader(token) })
    const text = await res.text()
    if (!res.ok) throw new Error(`Morning search ${res.status}: ${text.slice(0, 300)}`)
    const data = JSON.parse(text)
    return (data.items || data.documents || data.data || []) as any[]
  }

  const items = await trySearch(intl)
  if (items.length > 0) return items

  const items2 = await trySearch(local)
  return items2
}
