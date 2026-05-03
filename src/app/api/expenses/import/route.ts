// Bulk-import expenses from the accountant's XLSX export.
// Idempotent: matches on external_serial and updates in place; new rows insert.
// Uses service-role client so RLS doesn't block bulk operations.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import {
  ddmmyyyyToIso,
  parseAmount,
  parseDocumentNumberFlag,
  guessCategoryName,
} from '@/lib/expenses'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

interface ParsedRow {
  external_serial: string | null
  external_personal_number: string | null
  vendor: string
  document_number_raw: string | null
  amount: number | null
  recorded_at: string | null
  document_date: string | null
  notes: string | null
}

// Map a parsed Excel row (header→value) to our schema.
// Headers can vary — we accept either Hebrew or English.
function rowToParsed(row: Record<string, any>): ParsedRow | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (row[k] != null && row[k] !== '') return row[k]
    }
    return null
  }
  const vendor = String(get('שם ספק', 'vendor', 'Vendor') || '').trim()
  if (!vendor || vendor === 'לא הוזן') return null  // skip placeholder rows

  return {
    external_serial:          stringOrNull(get('מספר סידורי', 'serial')),
    external_personal_number: stringOrNull(get('מספור אישי', 'personal')),
    vendor,
    document_number_raw:      stringOrNull(get('מספר מסמך', 'doc_number', 'invoice_number')),
    amount:                   parseAmount(get('סכום', 'amount')),
    recorded_at:              ddmmyyyyToIso(stringOrNull(get('תאריך יצירה', 'created'))),
    document_date:            ddmmyyyyToIso(stringOrNull(get('תאריך מסמך', 'doc_date'))),
    notes:                    stringOrNull(get('הערות', 'notes')),
  }
}

function stringOrNull(v: any): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  let workbook: XLSX.WorkBook
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to parse XLSX: ' + (e as Error).message }, { status: 400 })
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return NextResponse.json({ error: 'Workbook has no sheets' }, { status: 400 })
  const sheet = workbook.Sheets[sheetName]
  const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null })

  const supabase = getSupabaseAdmin()

  // Pre-fetch categories so we can resolve name → id
  const { data: cats, error: catErr } = await supabase.from('expense_categories').select('id, name_he')
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 })
  const catMap = new Map((cats || []).map(c => [c.name_he, c.id]))

  const rowsToUpsert: Array<Record<string, any>> = []
  let skipped = 0

  for (const raw of json) {
    const parsed = rowToParsed(raw)
    if (!parsed) { skipped++; continue }

    const flag = parseDocumentNumberFlag(parsed.document_number_raw)
    const categoryName = guessCategoryName(parsed.vendor)
    const category_id  = catMap.get(categoryName) ?? catMap.get('אחר') ?? null

    rowsToUpsert.push({
      external_serial:          parsed.external_serial,
      external_personal_number: parsed.external_personal_number,
      vendor:                   parsed.vendor,
      document_date:            parsed.document_date,
      recorded_at:              parsed.recorded_at,
      amount:                   parsed.amount,
      invoice_number:           flag.invoice_number,
      status:                   flag.status,
      duplicate_of_serial:      flag.duplicate_of_serial,
      notes:                    parsed.notes,
      category_id,
    })
  }

  if (!rowsToUpsert.length) {
    return NextResponse.json({ inserted: 0, updated: 0, skipped, message: 'No valid rows' })
  }

  // Split: rows with external_serial → upsert by that key. Rows without → plain insert.
  const withSerial    = rowsToUpsert.filter(r => r.external_serial)
  const withoutSerial = rowsToUpsert.filter(r => !r.external_serial)

  let upserted = 0
  let inserted = 0

  if (withSerial.length) {
    const { data, error } = await supabase
      .from('expenses')
      .upsert(withSerial, { onConflict: 'external_serial', ignoreDuplicates: false })
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    upserted = data?.length ?? 0
  }

  if (withoutSerial.length) {
    const { data, error } = await supabase
      .from('expenses')
      .insert(withoutSerial)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted = data?.length ?? 0
  }

  return NextResponse.json({
    upserted,
    inserted,
    skipped,
    total_processed: rowsToUpsert.length,
  })
}
