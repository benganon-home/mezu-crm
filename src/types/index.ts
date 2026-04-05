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

export interface OrderItem {
  id: string
  order_id: string
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

// ─── Item color map ──────────────────────────────────────────────────────────

export const ITEM_COLOR_MAP: Record<string, { hex: string; border?: boolean }> = {
  'אפקט אבן שיש':  { hex: '#C0B8A8' },           // warm marble — 665 orders
  'בטון בהיר':     { hex: '#CDCAC4' },           // light concrete gray — 462 orders
  'לבן':           { hex: '#F4F2EE', border: true }, // white — 185 orders
  'בז\'':          { hex: '#D6C4A0' },           // warm beige — 133 orders
  'בטון אפור':     { hex: '#8E8E8E' },           // medium gray concrete — 46 orders
  'בטון בז\'':     { hex: '#BEAF98' },           // beige-tinted concrete — 15 orders
  'בטון שחור':     { hex: '#3A3530' },           // dark charcoal — 4 orders
  'שחור מאט':      { hex: '#1E1B18' },           // matte black — 1 order
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
