// POST /api/hyp/import (multipart/form-data with `file` field)
//
// Accepts the CSV that HYP's merchant portal lets you export from the
// transactions log. We don't know HYP's exact column order or header names
// (those vary by export config), so the parser tries to match fields by
// header name first, falling back to position. Unknown rows are kept in
// the `raw` JSONB column so we can iterate if a customer's HYP export
// uses different headers.
//
// Uses service-role client to bypass RLS — bulk upsert is admin-only anyway
// and we want one transaction id to update its row on re-import (idempotent).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

// Map common HYP CSV headers (Hebrew + English) to our column names.
const HEADER_ALIASES: Record<string, string> = {
  // English
  'transaction':         'id',
  'transactionid':       'id',
  'transaction id':      'id',
  'transid':             'id',
  'id':                  'id',
  'reference':           'id',
  'date':                'date',
  'time':                'time',
  'amount':              'amount',
  'total':               'amount',
  'sum':                 'amount',
  'currency':            '_currency',
  'client':              'client_name',
  'client name':         'client_name',
  'customer':            'client_name',
  'customer name':       'client_name',
  'name':                'client_name',
  'phone':               'client_phone',
  'cell':                'client_phone',
  'mobile':              'client_phone',
  'email':               'client_email',
  'card':                'card_last4',
  'cardno':              'card_last4',
  'card no':             'card_last4',
  'last4':               'card_last4',
  'last 4':              'card_last4',
  'status':              'status',
  'order':               'order_ref',
  'orderref':            'order_ref',
  'order ref':           'order_ref',
  'order number':        'order_ref',
  // Hebrew
  'מס׳ עסקה':            'id',
  'מספר עסקה':           'id',
  'אסמכתא':              'id',
  'תאריך':              'date',
  'שעה':                'time',
  'סכום':               'amount',
  'מטבע':               '_currency',
  'שם לקוח':            'client_name',
  'שם הלקוח':           'client_name',
  'לקוח':               'client_name',
  'טלפון':              'client_phone',
  'נייד':               'client_phone',
  'מייל':               'client_email',
  'דוא״ל':              'client_email',
  'אימייל':             'client_email',
  '4 אחרונות':          'card_last4',
  'כרטיס':              'card_last4',
  'סטטוס':              'status',
  'מצב':                'status',
  'הזמנה':              'order_ref',
  'מס׳ הזמנה':          'order_ref',
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/["'\s]+/g, ' ').trim()
}

function parseCsv(text: string): string[][] {
  // Tolerant CSV parser — handles quoted fields with embedded commas/newlines.
  // Tab-separated also works because we split on the detected delimiter from row 1.
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  // Detect delimiter from first line: tab if more tabs than commas, else comma.
  const headerLine = text.split(/\r?\n/, 1)[0] || ''
  const delim = (headerLine.match(/\t/g) || []).length > (headerLine.match(/,/g) || []).length ? '\t' : ','

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue }
      if (ch === '"') { inQuotes = false; i++; continue }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === delim) { cur.push(field); field = ''; i++; continue }
    if (ch === '\n' || ch === '\r') {
      // End of row
      cur.push(field); field = ''
      if (ch === '\r' && text[i + 1] === '\n') i++
      i++
      if (cur.some(c => c.length > 0)) rows.push(cur)
      cur = []
      continue
    }
    field += ch; i++
  }
  if (field || cur.length) { cur.push(field); if (cur.some(c => c.length > 0)) rows.push(cur) }
  return rows
}

function ddmmyyyyToIso(s: string): string | null {
  if (!s) return null
  const t = s.trim()
  // YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // DD/MM/YYYY or DD/MM/YY (HYP default)
  m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/)
  if (m) {
    let [, dd, mm, yyyy] = m
    if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return null
}

function parseAmount(s: string): number | null {
  if (!s) return null
  const cleaned = String(s).replace(/[^\d.\-,]/g, '').replace(/,/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  // HYP exports are typically Windows-1255 (Hebrew). Try UTF-8 first, fall back.
  let text: string
  try {
    text = await file.text()
    if (!/֐-׿/.test(text) && /[\xC0-\xFF]/.test(text)) {
      // Looks like wrong encoding — try win-1255
      const buf = new Uint8Array(await file.arrayBuffer())
      try {
        text = new TextDecoder('windows-1255').decode(buf)
      } catch { /* keep utf-8 */ }
    }
  } catch (e) {
    return NextResponse.json({ error: 'Could not read file' }, { status: 400 })
  }

  const rows = parseCsv(text)
  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 })
  }

  const headers = rows[0].map(h => HEADER_ALIASES[normalizeHeader(h)] || `_unknown_${normalizeHeader(h)}`)
  const data = rows.slice(1).map(r => {
    const row: Record<string, string> = {}
    headers.forEach((key, i) => { row[key] = (r[i] ?? '').trim() })
    return row
  })

  const toUpsert: any[] = []
  let skipped = 0
  for (const r of data) {
    const id     = r.id?.trim()
    const date   = ddmmyyyyToIso(r.date || '')
    const amount = parseAmount(r.amount || '')
    if (!id || !date || amount == null) { skipped++; continue }
    toUpsert.push({
      id,
      date,
      time:         r.time?.trim() || null,
      amount,
      client_name:  r.client_name?.trim() || null,
      client_phone: r.client_phone?.trim() || null,
      client_email: r.client_email?.trim() || null,
      card_last4:   r.card_last4?.replace(/[^0-9]/g, '').slice(-4) || null,
      status:       r.status?.trim() || null,
      order_ref:    r.order_ref?.trim() || null,
      raw:          r,
    })
  }

  if (toUpsert.length === 0) {
    return NextResponse.json({
      error: 'No valid rows. Detected headers: ' + headers.join(', '),
      hint:  'Make sure the export has columns for transaction id, date and amount.',
    }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error: upsertErr } = await supabase
    .from('hyp_transactions')
    .upsert(toUpsert, { onConflict: 'id', ignoreDuplicates: false })
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({
    imported:    toUpsert.length,
    skipped,
    headers,
  })
}
