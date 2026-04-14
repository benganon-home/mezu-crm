'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Search, ChevronDown, Download, Printer } from 'lucide-react'
import { Order, OrderItem, OrderStatus, ALL_STATUSES, STATUS_CONFIG } from '@/types'
import { UndoToast } from '@/components/ui/UndoToast'
import { formatPrice, cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/StatCard'
import { OrderDrawer } from '@/components/orders/OrderDrawer'
import { NewOrderDrawer } from '@/components/orders/NewOrderDrawer'
import { BulkStatusBar } from '@/components/orders/BulkStatusBar'
import { OrderRow } from '@/components/orders/OrderRow'
import { PendingOrdersBanner } from '@/components/orders/PendingOrdersBanner'
import { ExportModal } from '@/components/orders/ExportModal'

const DEFAULT_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'cancelled']
const PAGE_SIZE = 60

export default function OrdersPage() {
  const [allOrders, setAllOrders]     = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>(DEFAULT_STATUSES)
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'delivery' | 'pickup'>('all')
  const [preparingActive, setPreparingActive] = useState(false)
  const [readyActive, setReadyActive]         = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showExport, setShowExport]     = useState(false)
  const [page, setPage]               = useState(1)
  const [yearFilter, setYearFilter]   = useState<number>(new Date().getFullYear())
  const [undoPending, setUndoPending] = useState<{ itemId: string; orderId: string; item: OrderItem } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [morningRevenue, setMorningRevenue] = useState<number | null>(null)

  // ── Fetch all orders once (no server-side filtering) ──────────
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/orders?pageSize=1000')
      let json: { data?: Order[]; error?: string } = {}
      try { json = await res.json() } catch { /* HTML error page */ }
      if (!res.ok) { setLoadError(json.error || `שגיאת שרת (${res.status})`); return }
      setAllOrders(json.data || [])
    } catch {
      setLoadError('לא ניתן להתחבר לשרת')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Fetch real monthly revenue from Morning
  useEffect(() => {
    const now   = new Date()
    const from  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    fetch(`/api/morning-revenue?from=${from}`)
      .then(r => r.json())
      .then(d => { if (d.total != null) setMorningRevenue(d.total) })
      .catch(() => {})
  }, [])

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set(allOrders.map(o => new Date(o.created_at).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [allOrders])

  // ── Client-side filtering (instant, no network) ───────────────
  const filteredOrders = useMemo(() => {
    let result = allOrders.filter(o => new Date(o.created_at).getFullYear() === yearFilter)

    // Status: show orders with at least one item matching a selected status
    if (selectedStatuses.length < ALL_STATUSES.length) {
      result = result.filter(o =>
        (o.items || []).some(i => selectedStatuses.includes(i.status))
      )
    }

    // Stat card shortcuts
    if (preparingActive) {
      result = result.filter(o =>
        (o.items || []).some(i => i.status === 'preparing')
      )
    }
    if (readyActive) {
      result = result.filter(o =>
        (o.items || []).length > 0 && (o.items || []).every(i => i.status === 'ready')
      )
    }

    if (deliveryFilter !== 'all') {
      result = result.filter(o => o.delivery_type === deliveryFilter)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(o =>
        o.customer?.name?.toLowerCase().includes(q) ||
        o.customer?.phone?.includes(q) ||
        (o.delivery_address || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [allOrders, selectedStatuses, preparingActive, readyActive, deliveryFilter, search])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, selectedStatuses, deliveryFilter, preparingActive, readyActive, yearFilter])

  // ── Client-side pagination ────────────────────────────────────
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredOrders, page]
  )

// ── Stats from filtered set ───────────────────────────────────
  const stats = useMemo(() => ({
    total:     filteredOrders.length,
    preparing: filteredOrders.flatMap(o => o.items || []).filter(i => i.status === 'preparing').length,
    ready:     filteredOrders.filter(o =>
      (o.items || []).length > 0 && (o.items || []).every(i => i.status === 'ready')
    ).length,
    revenue:   filteredOrders.reduce((s, o) => s + (o.total_price || 0), 0),
  }), [filteredOrders])

  // ── Mark all preparing → ready ───────────────────────────────
  const markAllPreparingReady = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ids = allOrders
      .flatMap(o => o.items || [])
      .filter(i => i.status === 'preparing')
      .map(i => i.id)
    if (!ids.length) return
    await fetch('/api/order-items/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'ready' }),
    })
    fetchOrders()
  }

  // ── Mark all ready-to-ship → shipped ─────────────────────────
  const markAllReadyShipped = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ids = allOrders
      .filter(o => (o.items || []).length > 0 && (o.items || []).every(i => i.status === 'ready'))
      .flatMap(o => o.items || [])
      .map(i => i.id)
    if (!ids.length) return
    await fetch('/api/order-items/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'shipped' }),
    })
    fetchOrders()
  }

  // ── Selection ─────────────────────────────────────────────────
  const toggleItemSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const onDeleteItem = (itemId: string, orderId: string, item: OrderItem) => {
    // Optimistic remove
    setAllOrders(prev => prev
      .map(o => o.id !== orderId ? o : { ...o, items: (o.items || []).filter(i => i.id !== itemId) })
      .filter(o => (o.items || []).length > 0)
    )
    setSelectedItemIds(prev => { const next = new Set(prev); next.delete(itemId); return next })

    // Cancel any previous pending delete
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    // Show undo toast — actual DELETE fires after 5s
    setUndoPending({ itemId, orderId, item })
    undoTimerRef.current = setTimeout(() => {
      fetch(`/api/order-items/${itemId}`, { method: 'DELETE' })
      setUndoPending(null)
      undoTimerRef.current = null
    }, 5000)
  }

  const handleUndo = () => {
    if (!undoPending) return
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null }
    const { item, orderId } = undoPending
    setAllOrders(prev => {
      const order = prev.find(o => o.id === orderId)
      if (order) {
        return prev.map(o => o.id === orderId ? { ...o, items: [...(o.items || []), item] } : o)
      }
      // Order was removed (was the only item) — re-add it from allOrders via a refetch isn't available here,
      // so just trigger a refetch
      return prev
    })
    setUndoPending(null)
    // If order was fully removed (last item), refetch to restore it
    const orderStillExists = allOrders.some(o => o.id === undoPending.orderId)
    if (!orderStillExists) fetchOrders()
  }

  // ── Mutations ─────────────────────────────────────────────────
  const onBulkStatus = async (status: OrderStatus) => {
    await fetch('/api/order-items/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedItemIds), status }),
    })
    setSelectedItemIds(new Set())
    fetchOrders()
  }

  const onItemStatusChange = (itemId: string, newStatus: OrderStatus) => {
    setAllOrders(prev => prev.map(order => {
      const items = order.items?.map(i => i.id === itemId ? { ...i, status: newStatus } : i)
      return items ? { ...order, items } : order
    }))
    if (activeOrder?.items?.some(i => i.id === itemId)) {
      setActiveOrder(prev => prev ? {
        ...prev,
        items: prev.items?.map(i => i.id === itemId ? { ...i, status: newStatus } : i),
      } : null)
    }
  }

  const onOrderUpdate = (updated: Order) => {
    setAllOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    setActiveOrder(updated)
  }

  const toggleStatus = (s: OrderStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  const allSelected = selectedStatuses.length === ALL_STATUSES.length

  return (
    <div className={cn('flex flex-col gap-5', selectedItemIds.size > 0 && 'pb-24')}>

      {/* Page header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div>
            <h1>הזמנות</h1>
            <p className="text-xs text-muted mt-0.5">{stats.total} הזמנות</p>
          </div>
          {availableYears.length > 1 && (
            <div className="relative">
              <select
                value={yearFilter}
                onChange={e => setYearFilter(Number(e.target.value))}
                className="input text-sm cursor-pointer appearance-none pr-3 pl-7 py-1.5 font-medium"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/labels/ready"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2 text-sm"
            title="הדפס תוויות לכל ההזמנות המוכנות"
          >
            <Printer size={14} strokeWidth={1.5} />
            תוויות מוכן
          </a>
          <button
            onClick={() => setShowExport(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download size={14} strokeWidth={1.5} />
            ייצוא
          </button>
          <button
            onClick={() => setShowNewOrder(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={14} strokeWidth={1.5} />
            הזמנה חדשה
          </button>
        </div>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      {/* Pending orders from DataStore (paid but no phone match) */}
      <PendingOrdersBanner onOrderAdded={fetchOrders} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="סה״כ הזמנות"    value={stats.total}               sub="בסינון הנוכחי" />
        <StatCard label="בהכנה"          value={stats.preparing}            valueClass="text-orange-500"
          showFilter active={preparingActive}
          onClick={() => setPreparingActive(v => !v)}
          actionLabel="סמן כמוכן"
          onAction={markAllPreparingReady}
        />
        <StatCard label="מוכן לשליחה"    value={stats.ready}                valueClass="text-emerald-600"
          showFilter active={readyActive}
          onClick={() => setReadyActive(v => !v)}
          actionLabel="סמן כנשלח"
          onAction={markAllReadyShipped}
        />
        <StatCard
          label={morningRevenue != null ? `הכנסות ${new Date().toLocaleString('he-IL', { month: 'long' })}` : 'הכנסות (תצוגה)'}
          value={morningRevenue != null ? formatPrice(morningRevenue) : formatPrice(stats.revenue)}
          valueClass="text-gold"
          sub={morningRevenue != null ? 'ממורנינג — חודש נוכחי' : 'הערכה לפי הזמנות'}
        />
      </div>

      {/* Toolbar — single row */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative md:flex-1">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pr-9 w-full"
            placeholder="חיפוש לפי שם, טלפון, כתובת..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 items-center overflow-x-auto pb-0.5 md:shrink-0">
          <button onClick={() => setSelectedStatuses(ALL_STATUSES)} className={cn('chip-btn', allSelected && 'chip-btn-active')}>הכל</button>
          {ALL_STATUSES.map(s => {
            const active = selectedStatuses.includes(s)
            return (
              <button key={s} onClick={() => toggleStatus(s)}
                className={cn('badge cursor-pointer transition-all',
                  active
                    ? cn(STATUS_CONFIG[s].activeBg, STATUS_CONFIG[s].activeText, 'border-transparent font-semibold')
                    : cn(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].text, STATUS_CONFIG[s].border, 'opacity-50 hover:opacity-80')
                )}
              >
                <span className={cn('badge-dot', active ? 'bg-white/70' : STATUS_CONFIG[s].dot)} />
                {STATUS_CONFIG[s].label}
              </button>
            )
          })}
        </div>
        <div className="relative md:w-[200px] md:shrink-0">
          <select
            value={deliveryFilter}
            onChange={e => setDeliveryFilter(e.target.value as typeof deliveryFilter)}
            className="input text-sm cursor-pointer w-full appearance-none pr-3 pl-8"
          >
            <option value="all">סוג משלוח: הכל</option>
            <option value="delivery">משלוח</option>
            <option value="pickup">איסוף עצמי</option>
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
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

      {/* Orders */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">

        {/* Sticky column headers */}
        <div className="sticky top-0 z-10 text-[11px] font-medium text-muted border-b border-cream-dark dark:border-navy-light bg-cream dark:bg-navy-dark min-w-[820px]">
          <div className="flex mx-2">
            <div className="w-[260px] shrink-0 px-4 py-2.5 border-l border-cream-dark dark:border-navy-light">
              פרטי ההזמנה
            </div>
            <div className="flex-1 flex">
              <div className="w-[40px] shrink-0" />
              <div className="w-[52px] shrink-0" />
              <div className="flex-1 px-2 py-2.5">פריטים</div>
              <div className="w-[170px] shrink-0 px-2 py-2.5">צבע</div>
              <div className="w-[120px] shrink-0 px-2 py-2.5">טקסט</div>
              <div className="w-[110px] shrink-0 px-2 py-2.5">פונט</div>
              <div className="w-[70px] shrink-0 px-2 py-2.5 ltr">מחיר</div>
              <div className="w-[110px] shrink-0 px-2 py-2.5">סטטוס</div>
              <div className="w-[40px] shrink-0" />
            </div>
          </div>
        </div>

        {loading && <div className="text-center py-12 text-muted text-sm min-w-[820px]">טוען...</div>}
        {!loading && paginatedOrders.length === 0 && (
          <div className="text-center py-12 text-muted text-sm min-w-[820px]">לא נמצאו הזמנות</div>
        )}

        <div className="flex flex-col gap-2 p-2 bg-[#EEEDF5] dark:bg-navy-deeper min-w-[820px]">
          {paginatedOrders.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              selectedItemIds={selectedItemIds}
              onToggleItem={toggleItemSelect}
              onItemStatusChange={onItemStatusChange}
              onDeleteItem={onDeleteItem}
              onClick={() => setActiveOrder(order)}
            />
          ))}
        </div>
        </div>{/* end overflow-x-auto */}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-cream-dark dark:border-navy-light text-xs text-muted">
          <span>מציג {paginatedOrders.length} מתוך {filteredOrders.length}</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(filteredOrders.length / PAGE_SIZE) }, (_, i) => i + 1).slice(0, 7).map(p => (
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
          onDelete={id => setAllOrders(prev => prev.filter(o => o.id !== id))}
        />
      )}

      {/* New order drawer */}
      {showNewOrder && (
        <NewOrderDrawer
          onClose={() => setShowNewOrder(false)}
          onCreated={() => { setShowNewOrder(false); fetchOrders() }}
        />
      )}

      {/* Undo toast */}
      {undoPending && (
        <UndoToast
          key={undoPending.itemId}
          message={`"${undoPending.item.item_name}" נמחק`}
          onUndo={handleUndo}
          onDismiss={() => setUndoPending(null)}
        />
      )}
    </div>
  )
}
