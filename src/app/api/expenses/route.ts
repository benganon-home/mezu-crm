import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const search     = searchParams.get('search') || ''
  const status     = searchParams.get('status') || ''        // active | archived | duplicate_suspect | all
  const categoryId = searchParams.get('category_id') || ''
  const month      = searchParams.get('month') || ''         // "YYYY-MM"
  const year       = searchParams.get('year') || ''          // "YYYY"
  const page       = parseInt(searchParams.get('page') || '1')
  const pageSize   = Math.min(parseInt(searchParams.get('pageSize') || '500'), 2000)
  const from       = (page - 1) * pageSize
  const to         = from + pageSize - 1

  let query = supabase
    .from('expenses')
    .select(`*, category:expense_categories(*)`, { count: 'exact' })
    .order('document_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search)     query = query.or(`vendor.ilike.%${search}%,invoice_number.ilike.%${search}%,external_serial.ilike.%${search}%`)
  if (status && status !== 'all') query = query.eq('status', status)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    query = query.gte('document_date', `${month}-01`).lt('document_date', nextMonth(month))
  } else if (year && /^\d{4}$/.test(year)) {
    query = query.gte('document_date', `${year}-01-01`).lt('document_date', `${Number(year) + 1}-01-01`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, pageSize })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const { data, error } = await supabase.from('expenses').insert(body).select(`*, category:expense_categories(*)`).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m, 1) // m here is already +1 because JS months are 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
