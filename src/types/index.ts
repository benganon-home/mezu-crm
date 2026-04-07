// ─── Enums ───────────────────────────────────────────────────────────────────

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'shipped' | 'cancelled'

export type DeliveryType = 'delivery' | 'pickup'

export type OrderSource = 'site' | 'email' | 'whatsapp' | 'manual'

export type ReminderType = 'call' | 'whatsapp' | 'task'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string | null
  address?: string | null
  notes?: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // computed / joined
  total_orders?: number
  total_spent?: number
  last_order_at?: string | null
}

export interface ProductSize {
  label: string
  price: number
}

export interface Product {
  id: string
  name: string
  description?: string | null
  base_price: number
  sizes: ProductSize[]
  colors: string[]
  images: string[]
  category?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id?: string | null
  item_name: string
  model?: string | null
  color?: string | null
  sign_text?: string | null
  font?: string | null
  sign_type?: string | null
  size?: string | null
  price: number
  status: OrderStatus
  created_at: string
  // joined
  product?: { images?: string[] } | null
}

export interface Order {
  id: string
  customer_id: string
  order_group_id?: string | null
  status: OrderStatus
  delivery_type: DeliveryType
  delivery_address?: string | null
  source: OrderSource
  total_price: number
  is_pinned: boolean
  has_delivery_note: boolean
  tracking_number?: string | null
  invoice_id?: string | null
  invoice_url?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  // joined
  customer?: Customer
  items?: OrderItem[]
}

export interface SalesRuleCondition {
  category: string
  min_qty: number
  size?: string | null
}

export interface SalesRule {
  id: string
  name: string
  is_active: boolean
  conditions: SalesRuleCondition[]
  discount_type: 'percent' | 'fixed_total'
  discount_value: number
  created_at: string
}

export interface Reminder {
  id: string
  customer_id?: string | null
  order_id?: string | null
  type: ReminderType
  content: string
  due_date?: string | null
  is_done: boolean
  created_at: string
  // joined
  customer?: Pick<Customer, 'id' | 'name' | 'phone'>
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string
  bg: string
  text: string
  border: string
  dot: string
  activeBg: string
  activeText: string
}

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  received:  { label: 'התקבלה',  bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-200', dot: 'bg-slate-400',  activeBg: 'bg-slate-500',   activeText: 'text-white' },
  preparing: { label: 'בהכנה',   bg: 'bg-orange-50',  text: 'text-orange-600', border: 'border-orange-200',dot: 'bg-orange-500', activeBg: 'bg-orange-500',  activeText: 'text-white' },
  ready:     { label: 'מוכן',    bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500',activeBg: 'bg-emerald-500', activeText: 'text-white' },
  shipped:   { label: 'נשלח',    bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',  dot: 'bg-blue-500',   activeBg: 'bg-blue-500',    activeText: 'text-white' },
  cancelled: { label: 'בוטל',    bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-400',    activeBg: 'bg-red-400',     activeText: 'text-white' },
}

export const ALL_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'shipped', 'cancelled']

// ─── Fonts ───────────────────────────────────────────────────────────────────

export const FONTS = [
  'Heebo',
  'Rubik',
  'Bona Nova',
  'Frank Ruhl Libre',
  'Alef',
  'Karantina',
  'Oswald',
  'Saira Condensed',
  'Barlow Condensed',
  'Bebas Neue',
] as const

// ─── Item color map ──────────────────────────────────────────────────────────

export const ITEM_COLOR_MAP: Record<string, { hex: string; border?: boolean }> = {
  'דמוי שיש בהיר':    { hex: '#D8D3C8' },
  'דמוי שיש אפור חול': { hex: '#B8B0A0' },
  'דמוי שיש כהה':     { hex: '#6B6560' },
  'לבן שלג':          { hex: '#F5F3EF', border: true },
}

// ─── API response types ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}

export interface OrderFilters {
  status?: OrderStatus | 'all'
  delivery_type?: DeliveryType | 'all'
  search?: string
  page?: number
  pageSize?: number
}
