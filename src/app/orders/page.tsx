'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Truck } from 'lucide-react'
import { Order, OrderStatus, ALL_STATUSES, STATUS_CONFIG } from '@/types'
import { formatPrice, cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/StatCard'
import { OrderDrawer } from '@/components/orders/OrderDrawer'
import { BulkStatusBar } from '@/components/orders/BulkStatusBar'
import { OrderRow } from '@/components/orders/OrderRow'

export default function OrdersPage() {
  const [orders, setOrders]           = useState<Order[]>([])
  const [count, setCount]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'delivery' | 'pickup'>('all')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [page, setPage]               = useState(1)
  const [loadError, setLoadError]     = useState<string | null>(null)

  const allItemIds = useMemo(
    () => orders.flatMap(o => (o.items || []).map(i => i.id)),
    [orders]
  )

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const params = new URLSearchParams({
      status:   statusFilter,
      delivery: deliveryFilter,
      search,
      page:     String(page),
      pageSize: '60',
    })
    try {
      const res = await fetch(`/api/orders?${params}`)
      let json: { data?: Order[]; count?: number; error?: string } = {}
      try {
        json = await res.json()
      } catch {
        /* HTML error page etc. */
      }
      if (!res.ok) {
        setLoadError(json.error || `שגיאת שרת (${res.status})`)
        setOrders([])
        setCount(0)
        return
      }
      setOrders(json.data || [])
      setCount(json.count || 0)
    } catch {
      setLoadError('לא ניתן להתחבר לשרת')
      setOrders([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, deliveryFilter, search, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchOrders(), 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line

  const toggleItemSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleOrderItems = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation()
    const itemIds = (order.items || []).map(i => i.id)
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      const allSelected = itemIds.every(id => next.has(id))
      if (allSelected) {
        itemIds.forEach(id => next.delete(id))
      } else {
        itemIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedItemIds.size === allItemIds.length && allItemIds.length > 0) {
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds(new Set(allItemIds))
    }
  }

  const onBulkStatus = async (status: OrderStatus) => {
    await fetch('/api/order-items/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedItemIds), status }),
    })
    setSelectedItemIds(new Set())
    fetchOrders()
  }

  const onOrderUpdate = (updated: Order) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    setActiveOrder(updated)
  }

  // Stats
  const stats = {
    total:      count,
    preparing:  orders.filter(o => o.status === 'preparing').length,
    ready:      orders.filter(o => o.status === 'ready').length,
    revenue:    orders.reduce((s, o) => s + (o.total_price || 0), 0),
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>הזמנות</h1>
          <p className="text-xs text-muted mt-0.5">{count} הזמנות סה״כ</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={14} strokeWidth={1.5} />
          הזמנה חדשה
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="סה״כ הזמנות"    value={stats.total}                         sub="בסינון הנוכחי" />
        <StatCard label="בהכנה"          value={stats.preparing}                      valueClass="text-amber-600" />
        <StatCard label="מוכן לשליחה"    value={stats.ready}                          valueClass="text-emerald-600" />
        <StatCard label="הכנסות (תצוגה)" value={formatPrice(stats.revenue)}           valueClass="text-gold" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pr-9"
            placeholder="חיפוש לפי שם, טלפון, כתובת..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setStatusFilter('all'); setPage(1) }}
            className={cn('chip-btn', statusFilter === 'all' && 'chip-btn-active')}
          >
            הכל
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={cn(
                'badge cursor-pointer',
                STATUS_CONFIG[s].bg,
                STATUS_CONFIG[s].text,
                statusFilter === s ? 'ring-1 ring-current font-semibold' : 'opacity-70 hover:opacity-100'
              )}
            >
              <span className={cn('badge-dot', STATUS_CONFIG[s].dot)} />
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Delivery filter */}
        <button
          onClick={() => setDeliveryFilter(d => d === 'delivery' ? 'all' : 'delivery')}
          className={cn('btn-ghost flex items-center gap-1.5', deliveryFilter === 'delivery' && 'text-gold')}
        >
          <Truck size={13} strokeWidth={1.5} />
          משלוח בלבד
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedItemIds.size > 0 && (
        <BulkStatusBar
          count={selectedItemIds.size}
          onApply={onBulkStatus}
          onClear={() => setSelectedItemIds(new Set())}
        />
      )}

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {loadError}
          <span className="block mt-1 text-xs opacity-90">
            אם כתוב שחסרה טבלה — הריצו את <code className="text-[0.85em]">docs/schema.sql</code> ב־Supabase → SQL Editor.
            אחרת בדקו משתני סביבה (URL + מפתח) ב־Vercel / ‎.env.local.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.size === allItemIds.length && allItemIds.length > 0}
                    onChange={toggleSelectAll}
                    className="accent-gold"
                  />
                </th>
                <th className="w-28 text-left">תאריך</th>
                <th>לקוח</th>
                <th>כתובת</th>
                <th>סטטוס</th>
                <th className="w-10">משלוח</th>
                <th className="text-left w-24">מחיר</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-12 text-muted">טוען...</td></tr>
              )}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted">לא נמצאו הזמנות</td></tr>
              )}
              {orders.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  selectedItemIds={selectedItemIds}
                  onToggleItem={toggleItemSelect}
                  onToggleOrderItems={toggleOrderItems}
                  onClick={() => setActiveOrder(order)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-cream-dark dark:border-navy-light text-xs text-muted">
          <span>מציג {orders.length} מתוך {count}</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(count / 60) }, (_, i) => i + 1).slice(0, 7).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'w-7 h-7 rounded text-xs',
                  page === p
                    ? 'bg-navy text-cream dark:bg-gold dark:text-navy'
                    : 'hover:bg-cream dark:hover:bg-navy-light'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Order drawer */}
      {activeOrder && (
        <OrderDrawer
          order={activeOrder}
          onClose={() => setActiveOrder(null)}
          onUpdate={onOrderUpdate}
        />
      )}
    </div>
  )
}
