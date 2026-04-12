import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { searchInvoicesByName } from '@/lib/morning'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (key) return createClient(url, key)
  return createServerClient()
}

// Map Base44 sign type labels → catalog product names
const SIGN_MAP: Record<string, string> = {
  'שלט קלאסי':    'קלאסי',
  'קלאסי':        'קלאסי',
  'מסגרת':        'מסגרת',
  'מסגרת בולטת':  'מסגרת',
  'לב':           'לב',
}

function formatSignText(raw: string, mishpachat: string): string {
  if (!mishpachat || mishpachat.includes('לא')) return raw
  if (mishpachat.includes('מעל')) return `משפחת\n${raw}`
  return `משפחת ${raw}` // same row
}

export async function POST(req: NextRequest) {
  // Auth
  const secret = req.headers.get('x-webhook-secret') || ''
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  const {
    customer_name,
    phone,
    address,
    sign_text:   rawSignText  = '',
    mishpachat:  mishpachat   = '',
    font         = null,
    sign_type:   rawSignType  = null,
    color        = null,
    mezuzah_model             = null,
    mezuzah_size              = null,
    extra_qty:   extraQtyStr  = '0',
    extra_model               = null,
    total_price: totalStr     = '0',
  } = await req.json()

  const sign_text  = formatSignText(rawSignText, mishpachat)
  const cleanPhone = (phone || '').replace(/\D/g, '').replace(/^972/, '0')
  const totalPrice = parseFloat(totalStr) || 0
  const extraCount = parseInt(extraQtyStr) || 0

  // Normalize size: "18 ס״מ רגיל" → "18", "24 ס״מ" → "24", "16" → "16"
  const normalizeSize = (s: string | null | undefined): string | null => {
    if (!s) return null
    const m = s.match(/^(\d+)/)
    return m ? m[1] : s
  }
  const mezuzah_size_norm = normalizeSize(mezuzah_size)

  // ── 1. Find or create customer ────────────────────────────────
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', cleanPhone)
    .maybeSingle()

  let customerId: string
  if (existing) {
    customerId = existing.id
  } else {
    const { data: newCustomer, error: custErr } = await supabase
      .from('customers')
      .insert({ name: customer_name, phone: cleanPhone, address: address || null })
      .select('id')
      .single()
    if (custErr) return NextResponse.json({ error: custErr.message }, { status: 400 })
    customerId = newCustomer.id
  }

  // ── 2. Load product catalog for price lookups ─────────────────
  const { data: products = [] } = await supabase
    .from('products')
    .select('id, name, base_price, sizes')
    .eq('is_active', true)

  const lookupPrice = (name: string, size?: string | null): { id: string | null; price: number } => {
    const p = (products || []).find((x: any) => x.name === name)
    if (!p) return { id: null, price: 0 }
    if (size && p.sizes?.length > 0) {
      const s = p.sizes.find((x: any) => x.label === size)
      if (s) return { id: p.id, price: s.price }
    }
    return { id: p.id, price: p.base_price }
  }

  // ── 3. Build items ────────────────────────────────────────────
  const items: any[] = []

  // Main mezuzah
  if (mezuzah_model) {
    const { id: productId, price } = lookupPrice(mezuzah_model, mezuzah_size_norm)
    items.push({
      item_name:  mezuzah_model,
      model:      'מזוזות',
      size:       mezuzah_size_norm || null,
      color,
      price,
      product_id: productId,
      status:     'received',
    })
  }

  // Door sign
  if (rawSignType) {
    const catalogName = SIGN_MAP[rawSignType] ?? rawSignType
    const { id: productId, price } = lookupPrice(catalogName)
    items.push({
      item_name:  catalogName,
      model:      'שלטי בית',
      size:       null,
      color,
      sign_text,
      font,
      price,
      product_id: productId,
      status:     'received',
    })
  }

  // Extra mezuzot (always size 16, always ₪60 each)
  if (extraCount > 0 && extra_model) {
    const { id: productId } = lookupPrice(extra_model, '16')
    for (let i = 0; i < extraCount; i++) {
      items.push({
        item_name:  extra_model,
        model:      'מזוזות',
        size:       '16',
        color,
        price:      60,
        product_id: productId,
        status:     'received',
      })
    }
  }

  // ── 4. Apply sales rules ──────────────────────────────────────
  const { data: rulesData = [] } = await supabase
    .from('sales_rules')
    .select('*')
    .eq('is_active', true)

  const activeRules: any[] = rulesData || []
  const autoTotal = items.reduce((s: number, i: any) => s + (i.price || 0), 0)

  const matchingRule = activeRules.find((rule: any) =>
    rule.conditions.every((cond: any) => {
      const count = items.filter((i: any) =>
        i.model === cond.category && (!cond.size || i.size === cond.size)
      ).length
      return count >= cond.min_qty
    })
  ) ?? null

  let finalTotal = autoTotal
  if (matchingRule) {
    if (matchingRule.discount_type === 'fixed_total') {
      // Only apply the fixed discount to bundle items (min qty per condition).
      // Extra items (e.g. 5× 16cm mezuzot) keep their full price.
      const usedIndices = new Set<number>()
      matchingRule.conditions.forEach((cond: any) => {
        let needed = cond.min_qty
        items.forEach((item: any, idx: number) => {
          if (needed > 0 && !usedIndices.has(idx) && item.model === cond.category && (!cond.size || item.size === cond.size)) {
            usedIndices.add(idx)
            needed--
          }
        })
      })
      const bundleAutoTotal = items.reduce((s: number, i: any, idx: number) =>
        usedIndices.has(idx) ? s + (i.price || 0) : s, 0)
      const extraTotal = items.reduce((s: number, i: any, idx: number) =>
        !usedIndices.has(idx) ? s + (i.price || 0) : s, 0)
      // Distribute the fixed discount proportionally among bundle items only
      if (bundleAutoTotal > 0) {
        items.forEach((item: any, idx: number) => {
          if (usedIndices.has(idx)) {
            item.price = parseFloat(((item.price / bundleAutoTotal) * matchingRule.discount_value).toFixed(2))
          }
        })
      }
      finalTotal = matchingRule.discount_value + extraTotal
    } else {
      // Percentage discount applies to all items
      finalTotal = autoTotal * (1 - matchingRule.discount_value / 100)
      if (autoTotal > 0) {
        items.forEach((i: any) => { i.price = parseFloat(((i.price / autoTotal) * finalTotal).toFixed(2)) })
      }
    }
  }

  // ── 5. Create order ───────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id:      customerId,
      status:           'received',
      delivery_type:    'delivery',
      delivery_address: address || null,
      total_price:      finalTotal,
      source:           'site',
    })
    .select('id')
    .single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 })

  // ── 6. Create items ───────────────────────────────────────────
  if (items.length > 0) {
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(items.map(i => ({ ...i, order_id: order.id })))
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })
  }

  // ── 7. Auto-link Morning invoice by customer name ─────────────
  if (customer_name) {
    try {
      const invoices = await searchInvoicesByName(customer_name)
      if (invoices.length === 1) {
        await supabase
          .from('orders')
          .update({
            invoice_id:  invoices[0].id,
            invoice_url: invoices[0].url?.he || invoices[0].url?.origin || null,
          })
          .eq('id', order.id)
      }
    } catch {
      // Invoice linking is best-effort — don't fail the order creation
    }
  }

  // ── 8. Return full order ──────────────────────────────────────
  const { data: fullOrder } = await supabase
    .from('orders')
    .select('*, customer:customers(*), items:order_items(*, product:products(images))')
    .eq('id', order.id)
    .single()

  return NextResponse.json(fullOrder, { status: 201 })
}
