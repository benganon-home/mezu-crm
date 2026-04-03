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
}

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  received:  { label: 'התקבלה',  bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-200', dot: 'bg-slate-400'  },
  preparing: { label: 'בהכנה',   bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-400'  },
  ready:     { label: 'מוכן',    bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500'},
  shipped:   { label: 'נשלח',    bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',  dot: 'bg-blue-500'   },
  cancelled: { label: 'בוטל',    bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-400'    },
}

export const ALL_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'shipped', 'cancelled']

// ─── Item color map ──────────────────────────────────────────────────────────

export const ITEM_COLOR_MAP: Record<string, { hex: string; border?: boolean }> = {
  'שיש בהיר':      { hex: '#E8DDD3' },
  'שיש אפור חול':  { hex: '#C4B9A8' },
  'שיש אפור':      { hex: '#9A9A9A' },
  'שיש כהה':       { hex: '#4A4A4A' },
  'לבן שלג':       { hex: '#FAFAFA', border: true },
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
