// HYP / YaadPay transaction list — admin-side wrapper for the CRM.
// Uses the same MASOF / KEY / PassP creds as the storefront, mirrored
// here so the CRM can reconcile what HYP actually charged against
// what the orders table has.
//
// Docs: https://yaadpay.docs.apiary.io/
//
// The "GetTransLogJ" / "GetTransLog" endpoint returns every transaction
// on the merchant account in a date range — including those that didn't
// originate from the website (phone payments, terminal, manual payment
// links sent from the HYP dashboard, etc.).

const BASE_URL = 'https://icom.yaad.net/p/'
const MASOF    = process.env.YAADPAY_MASOF!
const KEY      = process.env.YAADPAY_KEY!
const PASSP    = process.env.YAADPAY_PASSP!

export interface HypTransaction {
  id:           string        // HYP transaction ID
  date:         string        // ISO 'YYYY-MM-DD'
  time?:        string        // 'HH:MM'
  amount:       number        // ILS, +charge / -refund (best-effort)
  client_name?: string
  client_phone?:string
  client_email?:string
  card_last4?:  string
  status?:      string        // 'success' | 'failed' | 'refund' | string (raw)
  order_ref?:   string        // the Order param we sent at createPayment time (HYP echoes it)
  raw:          Record<string, string>
}

// Convert dd/mm/yyyy → ddmmyyyy as HYP's older endpoints expect.
// Newer JSON endpoints accept yyyy-mm-dd; we try the friendliest format
// HYP knows, then fall back if it complains.
function ddmmyyyy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}${m[2]}${m[1]}`
}

interface ListOpts {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD (inclusive) */
  to:   string
}

interface ListResult {
  ok:           true
  transactions: HypTransaction[]
  raw_count:    number
  endpoint:     string
}

interface ListError {
  ok:        false
  error:     string
  raw?:      string       // raw upstream body for debugging
  endpoint?: string
}

export async function listTransactions(opts: ListOpts): Promise<ListResult | ListError> {
  // HYP exposes several "list" endpoints. We try the most explicit (JSON)
  // first, then fall back to the legacy URL-encoded one.
  const candidates = [
    { what: 'GetTransLogJ', label: 'json' },
    { what: 'GetTransLog',  label: 'tabular' },
  ]

  let lastRaw = ''
  let lastEndpoint = ''

  let lastCcode: string | null = null

  for (const c of candidates) {
    const params = new URLSearchParams({
      action:   'APISign',
      What:     c.what,
      Masof:    MASOF,
      KEY:      KEY,
      PassP:    PASSP,
      FromDate: ddmmyyyy(opts.from),
      ToDate:   ddmmyyyy(opts.to),
    })
    const url = `${BASE_URL}?${params.toString()}`
    lastEndpoint = url

    let text = ''
    try {
      const res = await fetch(url, { cache: 'no-store' })
      text = await res.text()
    } catch (err) {
      return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}`, endpoint: url }
    }
    lastRaw = text

    // Skip and try the next endpoint if HYP signals an error
    const ccodeMatch = /CCode=([^&\s]+)/.exec(text)
    if (ccodeMatch && ccodeMatch[1] !== '0') {
      lastCcode = ccodeMatch[1]
      continue
    }

    // Try JSON first
    if (c.label === 'json') {
      try {
        const parsed = JSON.parse(text)
        const rows = Array.isArray(parsed) ? parsed
          : Array.isArray(parsed?.data) ? parsed.data
          : Array.isArray(parsed?.rows) ? parsed.rows
          : null
        if (rows) {
          return {
            ok: true,
            transactions: rows.map(normalizeRow),
            raw_count: rows.length,
            endpoint: url,
          }
        }
      } catch {
        // not JSON; fall through to next candidate
      }
    }

    // Tabular fallback: pipe-delimited rows
    if (c.label === 'tabular' && text && !text.includes('CCode=')) {
      const rows = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.split('|'))
      // Probe the first row to find a header. Most HYP exports return:
      //   TransId | Date | Time | Amount | Currency | OrderRef | Client | Card4 | Status
      const header = rows[0] || []
      const headerLower = header.map(h => h.toLowerCase())
      const dataRows = headerLower.includes('transid') || headerLower.includes('id') ? rows.slice(1) : rows
      if (dataRows.length) {
        const idx = (...candidates: string[]) => {
          for (const cand of candidates) {
            const i = headerLower.indexOf(cand.toLowerCase())
            if (i >= 0) return i
          }
          return -1
        }
        const iId      = idx('TransId', 'Id')
        const iDate    = idx('Date')
        const iTime    = idx('Time')
        const iAmount  = idx('Amount')
        const iOrder   = idx('OrderRef', 'Order')
        const iClient  = idx('Client', 'ClientName')
        const iPhone   = idx('Cell', 'Phone')
        const iEmail   = idx('Email')
        const iCard    = idx('Card4', 'Last4')
        const iStatus  = idx('Status')
        return {
          ok: true,
          transactions: dataRows.map(r => normalizeRow({
            id:           pickByIdx(r, iId)     || pickByIdx(r, 0),
            Date:         pickByIdx(r, iDate)   || pickByIdx(r, 1),
            Time:         pickByIdx(r, iTime)   || pickByIdx(r, 2),
            Amount:       pickByIdx(r, iAmount) || pickByIdx(r, 3),
            OrderRef:     pickByIdx(r, iOrder),
            ClientName:   pickByIdx(r, iClient),
            Cell:         pickByIdx(r, iPhone),
            Email:        pickByIdx(r, iEmail),
            Card4:        pickByIdx(r, iCard),
            Status:       pickByIdx(r, iStatus),
            __raw:        r.join('|'),
          })),
          raw_count: dataRows.length,
          endpoint:  url,
        }
      }
    }
  }

  // Common CCode meanings — give the user something actionable instead of a generic parse-failure
  const ccodeMessages: Record<string, string> = {
    '904': 'API דוח-עסקאות לא מופעל בחשבון HYP שלך. צרי קשר עם תמיכת HYP (03-7770100) ובקשי להפעיל את GetTransLog על מסוף ' + MASOF + '.',
    '999': 'תקלה כללית מ-HYP. נסי שוב.',
    '101': 'פרטי האימות שגויים. בדקי YAADPAY_MASOF / YAADPAY_KEY / YAADPAY_PASSP.',
    '907': 'אין הרשאה לפעולה הזו על המסוף הזה.',
  }
  const friendly = lastCcode && ccodeMessages[lastCcode]
    ? ccodeMessages[lastCcode]
    : `HYP החזיר תגובה לא צפויה${lastCcode ? ` (CCode=${lastCcode})` : ''}.`

  return {
    ok:       false,
    error:    friendly,
    raw:      lastRaw.slice(0, 2000),
    endpoint: lastEndpoint,
  }
}

function pickByIdx(row: string[], i: number): string | undefined {
  if (i < 0 || i >= row.length) return undefined
  return row[i] === '' ? undefined : row[i]
}

function normalizeRow(r: any): HypTransaction {
  const id     = String(r.id ?? r.Id ?? r.TransId ?? r.transId ?? '').trim()
  const dateRaw = String(r.Date ?? r.date ?? '').trim()
  // HYP returns dd/mm/yyyy or yyyy-mm-dd inconsistently; normalize to ISO.
  let date = dateRaw
  const m = dateRaw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)
  if (m) {
    let [, dd, mm, yyyy] = m
    if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy
    date = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  const amountNum = Number(String(r.Amount ?? r.amount ?? '0').replace(/[^\d.\-]/g, '')) || 0
  return {
    id,
    date,
    time:         r.Time ?? r.time,
    amount:       amountNum,
    client_name:  r.ClientName ?? r.client_name,
    client_phone: r.Cell ?? r.Phone ?? r.client_phone,
    client_email: r.Email ?? r.client_email,
    card_last4:   r.Card4 ?? r.Last4 ?? r.card_last4,
    status:       r.Status ?? r.status,
    order_ref:    r.OrderRef ?? r.Order ?? r.order_ref,
    raw:          r,
  }
}
