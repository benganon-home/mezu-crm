// Helpers for the expenses module — VAT calc, vendor→category guess,
// duplicate-flag parsing, DD/MM/YYYY ↔ ISO date conversion.

import type { Expense, ExpenseStatus } from '@/types'

// ─── Vendor → category (best-effort guess) ───────────────────────────────────
// Each entry: a substring match (case-insensitive, normalized) and a target category name_he.
// The list is ordered — first match wins. Edit at will from the categories page.
const VENDOR_CATEGORY_HINTS: Array<{ match: string; category: string }> = [
  { match: 'meta',        category: 'שיווק' },
  { match: 'facebook',    category: 'שיווק' },
  { match: 'google',      category: 'שיווק' },
  { match: 'tiktok',      category: 'שיווק' },
  { match: 'anthropic',   category: 'כלים-תוכנה' },
  { match: 'openai',      category: 'כלים-תוכנה' },
  { match: 'chatgpt',     category: 'כלים-תוכנה' },
  { match: 'github',      category: 'כלים-תוכנה' },
  { match: 'vercel',      category: 'כלים-תוכנה' },
  { match: 'cursor',      category: 'כלים-תוכנה' },
  { match: 'figma',       category: 'כלים-תוכנה' },
  { match: 'k.express',   category: 'משלוחים' },
  { match: 'kexpress',    category: 'משלוחים' },
  { match: 'fedex',       category: 'משלוחים' },
  { match: 'ups',         category: 'משלוחים' },
  { match: 'דואר',         category: 'משלוחים' },
  { match: 'הוט',          category: 'טלקום' },
  { match: 'פלאפון',       category: 'טלקום' },
  { match: 'סלקום',        category: 'טלקום' },
  { match: 'בזק',          category: 'טלקום' },
  { match: 'partner',     category: 'טלקום' },
  { match: 'אלקטרה',       category: 'חשבונות' },
  { match: 'חשמל',         category: 'חשבונות' },
  { match: 'מים',          category: 'חשבונות' },
  { match: 'גז',           category: 'חשבונות' },
  { match: 'ארנונה',       category: 'חשבונות' },
  { match: 'מנהרות',       category: 'נסיעות' },
  { match: 'דלק',          category: 'נסיעות' },
  { match: 'sonol',       category: 'נסיעות' },
  { match: 'paz',         category: 'נסיעות' },
  { match: 'באג',          category: 'משרד' },
  { match: 'office depot',category: 'משרד' },
]

export function guessCategoryName(vendor: string): string {
  const v = vendor.toLowerCase().trim()
  for (const { match, category } of VENDOR_CATEGORY_HINTS) {
    if (v.includes(match.toLowerCase())) return category
  }
  return 'אחר'
}

// ─── Date conversion (DD/MM/YYYY ↔ YYYY-MM-DD) ───────────────────────────────
// Excel export uses DD/MM/YYYY. Postgres date wants YYYY-MM-DD.
export function ddmmyyyyToIso(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null
  const trimmed = s.trim()
  if (!trimmed) return null
  const m = trimmed.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/)
  if (!m) return null
  let [, dd, mm, yyyy] = m
  if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? '19' : '20') + yyyy
  const d = dd.padStart(2, '0')
  const mo = mm.padStart(2, '0')
  return `${yyyy}-${mo}-${d}`
}

export function isoToDdmmyyyy(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

// ─── Amount parsing ──────────────────────────────────────────────────────────
// Excel formats numbers like "1,599" or numeric. Returns null when blank.
export function parseAmount(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const cleaned = String(v).replace(/[,\s₪]/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// ─── VAT (Israeli rate, 18% as of 2025) ──────────────────────────────────────
export const VAT_RATE = 0.18
export function calcVat(totalIncVat: number): number {
  // total = net + vat = net * (1 + rate) → vat = total * rate / (1 + rate)
  return Math.round((totalIncVat * VAT_RATE / (1 + VAT_RATE)) * 100) / 100
}

// ─── Document-number flag detection ──────────────────────────────────────────
// The accountant's export sometimes puts flag text in the invoice_number column:
//   "חשוד ככפול עם מ.ס. 238"  → status=duplicate_suspect, duplicate_of_serial="238"
//   "נשלח לארכיון"             → status=archived
//   "<actual number>"          → status=active, invoice_number="<actual number>"
export function parseDocumentNumberFlag(raw: string | null | undefined): {
  status: ExpenseStatus
  invoice_number: string | null
  duplicate_of_serial: string | null
} {
  const v = (raw || '').trim()
  if (!v) return { status: 'active', invoice_number: null, duplicate_of_serial: null }

  if (v.includes('חשוד ככפול')) {
    const m = v.match(/מ\.?\s*ס\.?\s*(\d+)/)
    return {
      status: 'duplicate_suspect',
      invoice_number: null,
      duplicate_of_serial: m ? m[1] : null,
    }
  }

  if (v.includes('ארכיון') || v.includes('נשלח')) {
    return { status: 'archived', invoice_number: null, duplicate_of_serial: null }
  }

  return { status: 'active', invoice_number: v, duplicate_of_serial: null }
}

// ─── Monthly grouping for analytics ──────────────────────────────────────────
export function groupByMonth(expenses: Expense[]): Map<string, Expense[]> {
  const map = new Map<string, Expense[]>()
  for (const e of expenses) {
    if (!e.document_date || e.status !== 'active') continue
    const key = e.document_date.slice(0, 7) // "YYYY-MM"
    const arr = map.get(key) || []
    arr.push(e)
    map.set(key, arr)
  }
  return map
}

export function totalAmount(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + (e.status === 'active' ? Number(e.amount || 0) : 0), 0)
}

// ─── Recurring "is missing this month?" check ────────────────────────────────
// Given a recurring template + the month's existing expenses, return true if
// (a) the expected day has already passed AND
// (b) no expense from the same vendor exists in the month.
export function isRecurringMissingThisMonth(
  template: { vendor: string; expected_day_of_month?: number | null },
  monthExpenses: Expense[],
  today: Date = new Date(),
): boolean {
  const dayPassed = template.expected_day_of_month
    ? today.getDate() >= template.expected_day_of_month
    : true // null → any day in the month is "expected"
  if (!dayPassed) return false

  const vendorLc = template.vendor.toLowerCase().trim()
  const found = monthExpenses.some(e =>
    e.status === 'active' &&
    e.vendor.toLowerCase().includes(vendorLc),
  )
  return !found
}
