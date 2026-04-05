import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OrderFilters, OrderStatus } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const statusesParam = searchParams.get('statuses') || ''
  const statuses      = statusesParam ? (statusesParam.split(',') as OrderStatus[]) : []
  const search        = searchParams.get('search') || ''
  const delivery      = searchParams.get('delivery') || 'all'
  const page          = parseInt(searchParams.get('page') || '1')
  const pageSize      = parseInt(searchParams.get('pageSize') || '50')
  const from          = (page - 1) * pageSize
  const to            = from + pageSize - 1

  let query = supabase
    .from('orders')
    .select(`
      *,
      customer:customers(id, name, phone, email, address),
      items:order_items(*)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  // Filter by item statuses: show orders that have at least one item matching
  // any of the selected statuses. An order where ALL items are shipped and
  // shipped is not in the list will have no matching items and won't appear.
  if (statuses.length > 0) {
    const { data: matchingItems } = await supabase
      .from('order_items')
      .select('order_id')
      .in('status', statuses)

    if (!matchingItems || matchingItems.length === 0) {
      return NextResponse.json({ data: [], count: 0, page, pageSize })
    }
    const orderIds = [...new Set(matchingItems.map(i => i.order_id))]
    query = query.in('id', orderIds)
  }

  if (delivery !== 'all') query = query.eq('delivery_type', delivery)

  if (search) {
    const { data: matchedCustomers } = await supabase
      .from('customers')
      .select('id')
      .or(`name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%`)

    if (matchedCustomers && matchedCustomers.length > 0) {
      query = query.in('customer_id', matchedCustomers.map(c => c.id))
    } else {
      return NextResponse.json({ data: [], count: 0, page, pageSize })
    }
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, pageSize })
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
