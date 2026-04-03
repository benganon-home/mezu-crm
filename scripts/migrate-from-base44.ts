/**
 * MEZU CRM — Migration script: Base44 → Supabase
 * 
 * Usage:
 *   1. Fill in .env.local with Supabase credentials
 *   2. npm run migrate
 * 
 * What it does:
 *   - Fetches all 500 records from Base44 (68c655a4 app)
 *   - Groups rows by order_group_id into logical orders
 *   - Upserts customers by phone (dedup)
 *   - Creates orders + order_items
 *   - Maps old statuses → new statuses
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BASE44_APP_ID = '68c655a4315f6d1a8c30e408'
const BASE44_API_BASE = 'https://app.base44.com/api/apps'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Status mapping ───────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  received:    'received',
  modeling:    'preparing',
  in_progress: 'preparing',
  ready:       'ready',
  packed:      'ready',
  shipped:     'shipped',
  completed:   'shipped',
  cancelled:   'cancelled',
}

// ─── Types ────────────────────────────────────────────────────
interface Base44Order {
  id: string
  customer_name: string
  customer_phone: string
  item: string
  color?: string
  sign_text?: string
  price: number
  delivery_type: string
  delivery_address?: string
  status: string
  order_group_id?: string
  is_pinned: boolean
  has_delivery_note: boolean
  created_date: string
  updated_date: string
}

// ─── Fetch from Base44 ────────────────────────────────────────
async function fetchBase44Orders(): Promise<Base44Order[]> {
  const response = await fetch(
    `${BASE44_API_BASE}/${BASE44_APP_ID}/entities/Order?limit=500&sort=-created_date`,
    { headers: { 'Content-Type': 'application/json' } }
  )
  const data = await response.json()
  return data.entities || []
}

// ─── Parse item name into components ─────────────────────────
function parseItem(item: string, signText?: string) {
  // "מזוזה - דגם אלפא - גודל 16" → model=alpha, size=16
  // "שלט - קלאסי" → sign_type=classic
  const name = item.trim()
  let model: string | null = null
  let size: string | null = null
  let sign_type: string | null = null
  let font: string | null = null

  if (name.includes('אלפא') || name.includes('alpha')) model = 'alpha'
  else if (name.includes('בטא') || name.includes('beta')) model = 'beta'
  else if (name.includes('גמא') || name.includes('gamma')) model = 'gamma'
  else if (name.includes('דלתא') || name.includes('delta')) model = 'delta'

  if (name.includes('24') || name.includes('24 ס')) size = '24cm'
  else if (name.includes('16') || name.includes('16 ס')) size = '16cm'

  if (name.includes('קלאסי')) sign_type = 'classic'
  else if (name.includes('לב')) sign_type = 'heart'
  else if (name.includes('מסגרת')) sign_type = 'framed'

  // Parse font from sign_text: "שם המשפחה oswald" → font=Oswald
  if (signText) {
    const fontMatch = signText.match(/(heebo|rubik|oswald|bona nova|frank ruhl|alef|karantina|saira|barlow|bebas)/i)
    if (fontMatch) font = fontMatch[1]
  }

  return { model, size, sign_type, font }
}

// ─── Clean sign text (remove font suffix) ────────────────────
function cleanSignText(signText: string): string {
  return signText
    .replace(/\s*(heebo|rubik|oswald|bona nova|frank ruhl|alef|karantina|saira|barlow|bebas)\s*$/i, '')
    .replace(/^משפחת>/, 'משפחת ')
    .trim()
}

// ─── Main migration ───────────────────────────────────────────
async function migrate() {
  console.log('🚀 Starting MEZU CRM migration...\n')

  // 1. Fetch all Base44 records
  console.log('📥 Fetching from Base44...')
  const raw = await fetchBase44Orders()
  console.log(`   Found ${raw.length} raw records\n`)

  // 2. Group by order_group_id
  const groups = new Map<string, Base44Order[]>()
  const singles: Base44Order[] = []

  for (const r of raw) {
    if (r.is_sample) continue
    if (r.order_group_id) {
      if (!groups.has(r.order_group_id)) groups.set(r.order_group_id, [])
      groups.get(r.order_group_id)!.push(r)
    } else {
      singles.push(r)
    }
  }

  console.log(`📦 Grouped into ${groups.size} orders + ${singles.length} singles = ${groups.size + singles.length} total\n`)

  // 3. Collect unique customers
  const customerMap = new Map<string, { name: string; phone: string; address?: string }>()

  for (const [, items] of groups) {
    const first = items[0]
    const phone = first.customer_phone?.trim() || 'unknown'
    if (!customerMap.has(phone)) {
      customerMap.set(phone, { name: first.customer_name, phone, address: first.delivery_address })
    }
  }
  for (const r of singles) {
    const phone = r.customer_phone?.trim() || 'unknown'
    if (!customerMap.has(phone)) {
      customerMap.set(phone, { name: r.customer_name, phone, address: r.delivery_address })
    }
  }

  console.log(`👥 Upserting ${customerMap.size} customers...`)
  const { data: insertedCustomers, error: custErr } = await supabase
    .from('customers')
    .upsert(
      Array.from(customerMap.values()).map(c => ({ name: c.name, phone: c.phone, address: c.address || null })),
      { onConflict: 'phone', ignoreDuplicates: false }
    )
    .select('id, phone')

  if (custErr) { console.error('Customer error:', custErr); process.exit(1) }
  
  const phoneToId = new Map<string, string>()
  for (const c of insertedCustomers || []) phoneToId.set(c.phone, c.id)
  console.log(`   ✅ ${insertedCustomers?.length} customers upserted\n`)

  // 4. Insert orders + items
  let ordersCreated = 0
  let itemsCreated = 0
  let skipped = 0

  const processGroup = async (groupId: string | null, items: Base44Order[]) => {
    const first = items[0]
    const phone = first.customer_phone?.trim() || 'unknown'
    const customerId = phoneToId.get(phone)
    if (!customerId) { console.warn(`  ⚠️ No customer for phone ${phone}`); skipped++; return }

    const totalPrice = items.reduce((s, i) => s + (i.price || 0), 0) / items.length // avg (items share same price in Base44)
    const mappedStatus = STATUS_MAP[first.status] || 'received'

    const orderPayload = {
      customer_id:      customerId,
      order_group_id:   groupId,
      status:           mappedStatus,
      delivery_type:    first.delivery_type === 'delivery' ? 'delivery' : 'pickup',
      delivery_address: first.delivery_address || null,
      source:           'site' as const,
      total_price:      first.price || 0,
      is_pinned:        first.is_pinned || false,
      has_delivery_note: first.has_delivery_note || false,
      created_at:       first.created_date,
      updated_at:       first.updated_date,
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single()

    if (orderErr) {
      if (orderErr.code === '23505') { skipped++; return } // duplicate group
      console.error('Order error:', orderErr); return
    }

    ordersCreated++

    // Insert items
    const itemPayloads = items.map(i => {
      const parsed = parseItem(i.item, i.sign_text)
      return {
        order_id:  order.id,
        item_name: i.item,
        model:     parsed.model,
        color:     i.color || null,
        sign_text: i.sign_text ? cleanSignText(i.sign_text) : null,
        font:      parsed.font,
        sign_type: parsed.sign_type,
        size:      parsed.size,
        price:     i.price || 0,
        created_at: i.created_date,
      }
    })

    const { error: itemErr } = await supabase.from('order_items').insert(itemPayloads)
    if (itemErr) console.error('Item error:', itemErr)
    else itemsCreated += itemPayloads.length
  }

  console.log('📝 Inserting orders...')
  for (const [groupId, items] of groups) await processGroup(groupId, items)
  for (const single of singles) await processGroup(null, [single])

  console.log(`\n✅ Migration complete!`)
  console.log(`   Orders created: ${ordersCreated}`)
  console.log(`   Items created:  ${itemsCreated}`)
  console.log(`   Skipped:        ${skipped}`)
}

migrate().catch(console.error)
