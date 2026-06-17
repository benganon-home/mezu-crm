import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const page     = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '60')
  const from     = (page - 1) * pageSize
  const to       = from + pageSize - 1

  const dateFrom = searchParams.get('dateFrom')
  const dateTo   = searchParams.get('dateTo')

  let query = supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, name, phone, email, address),
      items:order_items(*, product:products(images))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59')

  const { data, error, count } = dateFrom || dateTo
    ? await query
    : await query.range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach the real amount charged via HYP (matched by invoice_id ↔ HYP txn id,
  // then order_ref ↔ order_number) — the source of truth for what the customer
  // actually paid, incl. shipping. null when no HYP transaction is linked.
  const orders = (data ?? []) as any[]
  const invoiceIds = [...new Set(orders.map(o => o.invoice_id).filter(Boolean).map(String))]
  const hasNums = orders.some(o => o.order_number)
  if (invoiceIds.length || hasNums) {
    const byId  = new Map<string, number>()
    const byRef = new Map<string, number>()
    const [{ data: hById }, { data: hByRef }] = await Promise.all([
      invoiceIds.length ? supabase.from('hyp_transactions').select('id, amount').in('id', invoiceIds) : Promise.resolve({ data: [] as any[] }),
      hasNums ? supabase.from('hyp_transactions').select('order_ref, amount').not('order_ref', 'is', null) : Promise.resolve({ data: [] as any[] }),
    ])
    for (const h of (hById ?? [])) byId.set(String(h.id), Number(h.amount))
    for (const h of (hByRef ?? [])) byRef.set(String(h.order_ref).slice(0, 8), Number(h.amount))
    for (const o of orders) {
      const amt = (o.invoice_id ? byId.get(String(o.invoice_id)) : undefined)
        ?? (o.order_number ? byRef.get(String(o.order_number).slice(0, 8)) : undefined)
      o.paid_amount = amt ?? null
    }
  }

  return NextResponse.json({ data: orders, count, page, pageSize })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('orders')
    .insert(body)
    .select(`*, customer:customers(*), items:order_items(*)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
