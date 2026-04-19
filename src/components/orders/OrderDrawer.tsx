'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, MessageCircle, Edit2, Plus, Trash2, Package, AlertTriangle, Check, ChevronDown, FileText, Loader2, ExternalLink, Search, Truck, Printer, RefreshCw } from 'lucide-react'
import { Order, OrderItem, OrderStatus, ALL_STATUSES, STATUS_CONFIG, ITEM_COLOR_MAP, FONTS, Product, ProductSize, SalesRule } from '@/types'
import { formatDate, formatPrice, cn } from '@/lib/utils'
import { getWaLink, getInvoiceWaLink } from '@/lib/whatsapp'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { useDrawerAnimation } from '@/hooks/useDrawerAnimation'

interface Props {
  order: Order
  onClose: () => void
  onUpdate: (order: Order) => void
  onDelete?: (orderId: string) => void
}

export function OrderDrawer({ order, onClose, onUpdate, onDelete }: Props) {
  const { visible, close } = useDrawerAnimation(onClose)
  const [saving, setSaving]               = useState(false)
  const [status, setStatus]               = useState<OrderStatus>(order.status)
  const [notes, setNotes]                 = useState(order.notes || '')
  const [tracking, setTracking]           = useState(['', '0', null, undefined].includes(order.tracking_number as any) ? '' : order.tracking_number || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  // Invoice
  const [invoiceId, setInvoiceId]     = useState(order.invoice_id || null)
  const [invoiceUrl, setInvoiceUrl]   = useState(order.invoice_url || null)
  const [invoiceError, setInvoiceError]         = useState<string | null>(null)
  const [searchingInvoices, setSearchingInvoices] = useState(false)
  const [morningInvoices, setMorningInvoices]     = useState<any[] | null>(null)
  const [linkingId, setLinkingId]               = useState<string | null>(null)

  // Shipping (Run) — parse address for pre-fill
  const parsed = (() => {
    const addr = order.delivery_address || ''
    const empty = { city: '', street: '', building: '', floor: '', apartment: '' }
    if (!addr) return empty
    const lastComma = addr.lastIndexOf(',')
    if (lastComma === -1) return { ...empty, street: addr.trim() }
    const city = addr.slice(lastComma + 1).trim()
    const raw  = addr.slice(0, lastComma).trim()
    const full = raw.match(/^(.+?)\s+(\d+)\s+קומה\s+(\d+)\s+דירה\s+(\d+)\s*$/i)
    if (full) return { city, street: full[1].trim(), building: full[2], floor: full[3], apartment: full[4] }
    const withApt = raw.match(/^(.+?)\s+(\d+)\s+דירה\s+(\d+)\s*$/i)
    if (withApt) return { city, street: withApt[1].trim(), building: withApt[2], floor: '', apartment: withApt[3] }
    const withFloor = raw.match(/^(.+?)\s+(\d+)\s+קומה\s+(\d+)\s*$/i)
    if (withFloor) return { city, street: withFloor[1].trim(), building: withFloor[2], floor: withFloor[3], apartment: '' }
    const slash = raw.match(/^(.+?)\s+(\d+)\/(\d+)\s*$/)
    if (slash) return { city, street: slash[1].trim(), building: slash[2], floor: '', apartment: slash[3] }
    const simple = raw.match(/^(.+?)\s+(\d+[א-ת]?)\s*$/)
    if (simple) return { city, street: simple[1].trim(), building: simple[2], floor: '', apartment: '' }
    return { city, street: raw, building: '', floor: '', apartment: '' }
  })()

  const [showShipForm, setShowShipForm]         = useState(false)
  const [shipCity, setShipCity]                 = useState(parsed.city)
  const [shipStreet, setShipStreet]             = useState(parsed.street)
  const [shipBuilding, setShipBuilding]         = useState(parsed.building)
  const [shipFloor, setShipFloor]               = useState(parsed.floor)
  const [shipApt, setShipApt]                   = useState(parsed.apartment)
  const [creatingShipment, setCreatingShipment] = useState(false)
  const [shipmentError, setShipmentError]       = useState<string | null>(null)
  const [trackingEvents, setTrackingEvents]     = useState<any[] | null>(null)
  const [loadingTracking, setLoadingTracking]   = useState(false)

  // Customer editing
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [editName, setEditName]   = useState(order.customer?.name || '')
  const [editPhone, setEditPhone] = useState(order.customer?.phone || '')
  const [savingCustomer, setSavingCustomer] = useState(false)

  // Address editing
  const [editingAddress, setEditingAddress] = useState(false)
  const [editAddress, setEditAddress]       = useState(order.delivery_address || '')
  const [savingAddress, setSavingAddress]   = useState(false)

  // Items state (local copy for optimistic updates)
  const [items, setItems] = useState<OrderItem[]>(order.items || [])

  // Catalog + sales rules
  const [catalog, setCatalog]         = useState<Product[]>([])
  const [salesRules, setSalesRules]   = useState<SalesRule[]>([])
  const [addingItem, setAddingItem]   = useState(false)

  // New item form
  const [newProduct, setNewProduct]   = useState<Product | null>(null)
  const [newSize, setNewSize]         = useState('')
  const [newColor, setNewColor]       = useState('')
  const [newSignText, setNewSignText] = useState('')
  const [newFont, setNewFont]         = useState('')
  const [newPrice, setNewPrice]       = useState('')
  const [savingItem, setSavingItem]   = useState(false)

  const customer = order.customer

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setCatalog(Array.isArray(d) ? d.filter((p: Product) => p.is_active) : []))
    fetch('/api/sales-rules').then(r => r.json()).then(d => setSalesRules(Array.isArray(d) ? d.filter((r: SalesRule) => r.is_active) : []))
  }, [])

  // ── Sales rule matching ───────────────────────────────────────
  const autoTotal = items.reduce((s, i) => s + (i.price || 0), 0)

  const matchingRule = useMemo(() => {
    if (items.length === 0) return null
    return salesRules.find(rule =>
      rule.conditions.every(cond => {
        const count = items.filter(i =>
          i.model === cond.category && (!cond.size || i.size === cond.size)
        ).length
        return count >= cond.min_qty
      })
    ) ?? null
  }, [items, salesRules])

  const finalTotal = useMemo(() => {
    if (!matchingRule) return autoTotal
    if (matchingRule.discount_type === 'fixed_total') return matchingRule.discount_value
    return autoTotal * (1 - matchingRule.discount_value / 100)
  }, [matchingRule, autoTotal])

  // Patch order total whenever items or rule changes
  const patchTotal = async (updatedItems: OrderItem[]) => {
    const total = updatedItems.reduce((s, i) => s + (i.price || 0), 0)
    let newTotal = total
    const rule = salesRules.find(r =>
      r.conditions.every(cond => {
        const count = updatedItems.filter(i =>
          i.model === cond.category && (!cond.size || i.size === cond.size)
        ).length
        return count >= cond.min_qty
      })
    )
    if (rule) {
      newTotal = rule.discount_type === 'fixed_total'
        ? rule.discount_value
        : total * (1 - rule.discount_value / 100)
    }
    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_price: newTotal }),
    })
  }

  // ── General order save ────────────────────────────────────────
  const save = async (patch: Partial<Order>) => {
    setSaving(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const updated = await res.json()
    onUpdate({ ...order, ...updated, items, customer })
    setSaving(false)
  }

  const onStatusChange = async (s: OrderStatus) => {
    setStatus(s)
    await save({ status: s })
  }

  // ── Customer save ─────────────────────────────────────────────
  const saveCustomer = async () => {
    setSavingCustomer(true)
    const normalizedPhone = editPhone.replace(/\D/g, '').replace(/^972/, '0')
    const lookupRes  = await fetch(`/api/customers?phone=${encodeURIComponent(normalizedPhone)}`)
    const lookupJson = await lookupRes.json()
    const existing   = (lookupJson.data || [])[0]
    let customerId: string
    if (existing) {
      if (existing.name !== editName) {
        await fetch(`/api/customers/${existing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName }),
        })
      }
      customerId = existing.id
    } else {
      const createRes  = await fetch('/api/customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: normalizedPhone }),
      })
      const newCust = await createRes.json()
      customerId    = newCust.id
    }
    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId }),
    })
    onUpdate({ ...order, items, customer: { ...(order.customer!), id: customerId, name: editName, phone: normalizedPhone } })
    setEditingCustomer(false)
    setSavingCustomer(false)
  }

  // ── Address save ──────────────────────────────────────────────
  const saveAddress = async () => {
    setSavingAddress(true)
    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_address: editAddress }),
    })
    onUpdate({ ...order, items, customer, delivery_address: editAddress })
    setEditingAddress(false)
    setSavingAddress(false)
  }

  // ── Item delete ───────────────────────────────────────────────
  const deleteItem = async (itemId: string) => {
    await fetch(`/api/order-items/${itemId}`, { method: 'DELETE' })
    const updated = items.filter(i => i.id !== itemId)
    setItems(updated)
    onUpdate({ ...order, items: updated, customer })
    await patchTotal(updated)
  }

  // ── Item update ───────────────────────────────────────────────
  const updateItem = async (itemId: string, patch: Partial<OrderItem>) => {
    const res  = await fetch(`/api/order-items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const saved   = await res.json()
    const updated = items.map(i => i.id === itemId ? { ...i, ...saved } : i)
    setItems(updated)
    onUpdate({ ...order, items: updated, customer })
    await patchTotal(updated)
  }

  // ── Add item ──────────────────────────────────────────────────
  const selectProduct = (p: Product | null) => {
    setNewProduct(p)
    setNewSize('')
    if (p) {
      setNewPrice(p.sizes?.length ? '' : String(p.base_price))
    } else {
      setNewPrice('')
    }
  }

  const selectSize = (label: string) => {
    setNewSize(label)
    if (newProduct) {
      const s = newProduct.sizes?.find(x => x.label === label)
      setNewPrice(s ? String(s.price) : String(newProduct.base_price))
    }
  }

  const addItem = async () => {
    if (!newProduct) return
    setSavingItem(true)
    const res = await fetch('/api/order-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id:   order.id,
        item_name:  newProduct.name,
        model:      newProduct.category || null,
        size:       newSize || null,
        color:      newColor || null,
        sign_text:  newSignText || null,
        font:       newFont || null,
        price:      parseFloat(newPrice) || 0,
        product_id: newProduct.id,
        status:     'received',
      }),
    })
    const created = await res.json()
    const updated = [...items, created]
    setItems(updated)
    onUpdate({ ...order, items: updated, customer })
    await patchTotal(updated)
    setNewProduct(null); setNewSize(''); setNewColor(''); setNewSignText(''); setNewFont(''); setNewPrice('')
    setAddingItem(false)
    setSavingItem(false)
  }

  // ── Delete order ──────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' })
    if (!res.ok) { setDeleting(false); return }
    onDelete?.(order.id)
    close()
  }

  // ── Search Morning for invoices ───────────────────────────────
  const searchMorningInvoices = async () => {
    setSearchingInvoices(true)
    setInvoiceError(null)
    setMorningInvoices(null)
    try {
      const res  = await fetch(`/api/orders/${order.id}/invoice`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בחיפוש חשבוניות')

      const all      = data.invoices || []
      const name     = customer?.name?.trim() || ''
      const matched  = all.filter((inv: any) => inv.clientName?.trim() === name)

      // Auto-link if there's exactly one match for this customer
      if (matched.length === 1) {
        await linkInvoice(matched[0])
        return
      }

      // Multiple matches → show only their invoices (most recent first)
      // No match → show all recent so user can pick manually
      setMorningInvoices(matched.length > 1 ? matched : all)
    } catch (err: any) {
      setInvoiceError(err.message)
    } finally {
      setSearchingInvoices(false)
    }
  }

  // ── Link chosen Morning invoice ───────────────────────────────
  const linkInvoice = async (inv: any) => {
    setLinkingId(inv.id)
    const invoiceId  = String(inv.number)   // show readable number, not UUID
    const invoiceUrl = inv.url || ''
    await fetch(`/api/orders/${order.id}/invoice`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoiceId, invoice_url: invoiceUrl }),
    })
    setInvoiceId(invoiceId)
    setInvoiceUrl(invoiceUrl)
    setMorningInvoices(null)
    onUpdate({ ...order, items, customer, invoice_id: invoiceId, invoice_url: invoiceUrl })
    setLinkingId(null)
  }

  // ── Create Run shipment ───────────────────────────────────────
  const createRunShipment = async () => {
    setCreatingShipment(true)
    setShipmentError(null)
    try {
      const res  = await fetch('/api/shipments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          order_id: order.id,
          city:     shipCity.trim(),
          street:   shipStreet.trim(),
          building: shipBuilding.trim(),
          floor:    shipFloor.trim(),
          apartment: shipApt.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת משלוח')
      setTracking(data.shipNum)
      setShowShipForm(false)
      onUpdate({ ...order, items, customer, tracking_number: data.shipNum })
    } catch (err: any) {
      setShipmentError(err.message)
    } finally {
      setCreatingShipment(false)
    }
  }

  // ── Load Run tracking ─────────────────────────────────────────
  const loadTracking = async (shipNum: string) => {
    setLoadingTracking(true)
    try {
      const res  = await fetch(`/api/shipments/${shipNum}/tracking`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTrackingEvents(data.events || [])
    } catch {
      setTrackingEvents([])
    } finally {
      setLoadingTracking(false)
    }
  }

  const waReady   = customer ? getWaLink(customer, 'order_ready',   { itemSummary: items.map(i => i.item_name).join(', ') }) : '#'
  const waShipped = customer ? getWaLink(customer, 'order_shipped',  { trackingNumber: tracking, invoiceUrl: invoiceUrl || undefined }) : '#'
  const waInvoice = customer && invoiceUrl ? getInvoiceWaLink(customer, invoiceUrl) : null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={close}
      />

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-white dark:bg-navy-dark rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1">מחיקת הזמנה</h3>
            <p className="text-sm text-muted mb-5">
              האם למחוק את ההזמנה של <span className="font-medium text-navy dark:text-cream">{customer?.name}</span>?<br />
              פעולה זו אינה ניתנת לביטול.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-full transition-colors disabled:opacity-50">
                {deleting ? 'מוחק...' : 'כן, מחק'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 btn-secondary py-2.5">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      <div className={cn('drawer', visible && 'open')}>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-navy-dark border-b border-cream-dark dark:border-navy-light px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {editingCustomer ? (
                <div className="flex flex-col gap-2">
                  <input className="input text-sm" placeholder="שם לקוח" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                  <input className="input text-sm ltr" placeholder="טלפון" value={editPhone} onChange={e => setEditPhone(e.target.value)} dir="ltr" />
                  <div className="flex gap-2 mt-1">
                    <button onClick={saveCustomer} disabled={savingCustomer || !editName.trim() || !editPhone.trim()}
                      className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                      <Check size={12} />{savingCustomer ? 'שומר...' : 'שמור'}
                    </button>
                    <button onClick={() => { setEditingCustomer(false); setEditName(customer?.name || ''); setEditPhone(customer?.phone || '') }}
                      className="btn-secondary text-xs px-4 py-1.5">ביטול</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{customer?.name}</span>
                    <button onClick={() => setEditingCustomer(true)} className="text-muted hover:text-gold transition-colors" title="עריכת פרטי לקוח">
                      <Edit2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="ltr text-sm text-muted">{customer?.phone}</span>
                    <CopyButton text={customer?.phone || ''} />
                  </div>
                </div>
              )}
            </div>
            <button onClick={close} className="text-muted hover:text-navy dark:hover:text-cream p-2 rounded shrink-0">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-6">

          {/* Products */}
          <div>
            <div className="label mb-2">מוצרים בהזמנה ({items.length})</div>

            <div className="flex flex-col gap-2">
              {items.map(item => (
                <EditableItemCard
                  key={item.id}
                  item={item}
                  catalog={catalog}
                  onSave={(patch) => updateItem(item.id, patch)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </div>

            {!addingItem && (
              <button onClick={() => setAddingItem(true)}
                className="mt-2 flex items-center gap-1.5 text-xs text-gold hover:underline">
                <Plus size={12} /> הוסף מוצר
              </button>
            )}

            {addingItem && (
              <div className="mt-3 border border-cream-dark dark:border-navy-light rounded-xl p-3 flex flex-col gap-2.5 bg-cream/50 dark:bg-navy-deeper/50">
                <div className="label text-xs mb-0">מוצר חדש</div>

                {/* Product picker */}
                <div className="relative">
                  <select
                    className="input text-sm w-full appearance-none pr-3 pl-7 cursor-pointer"
                    value={newProduct?.id || ''}
                    onChange={e => {
                      const p = catalog.find(x => x.id === e.target.value) || null
                      selectProduct(p)
                    }}
                  >
                    <option value="">בחר מוצר *</option>
                    {catalog.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.base_price)}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>

                {/* Size picker */}
                {(newProduct?.sizes?.length ?? 0) > 0 && (
                  <div className="relative">
                    <select
                      className="input text-sm w-full appearance-none pr-3 pl-7 cursor-pointer"
                      value={newSize}
                      onChange={e => selectSize(e.target.value)}
                    >
                      <option value="">גודל — ללא</option>
                      {newProduct!.sizes.map((s: ProductSize) => (
                        <option key={s.label} value={s.label}>{s.label} — {formatPrice(s.price)}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                )}

                {/* Color */}
                <ColorPicker value={newColor} onChange={setNewColor} />

                <input className="input text-sm" placeholder="טקסט על השלט" value={newSignText} onChange={e => setNewSignText(e.target.value)} />

                <div className="relative">
                  <select className="input text-sm w-full appearance-none pr-3 pl-7" value={newFont} onChange={e => setNewFont(e.target.value)}>
                    <option value="">פונט — ללא</option>
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>

                <input className="input text-sm ltr" placeholder="מחיר (₪)" value={newPrice}
                  onChange={e => setNewPrice(e.target.value)} type="number" min="0" dir="ltr" />

                <div className="flex gap-2">
                  <button onClick={addItem} disabled={savingItem || !newProduct}
                    className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                    <Check size={12} />{savingItem ? 'שומר...' : 'הוסף'}
                  </button>
                  <button onClick={() => { setAddingItem(false); selectProduct(null); setNewColor(''); setNewSignText(''); setNewFont('') }}
                    className="btn-secondary text-xs px-4 py-1.5">ביטול</button>
                </div>
              </div>
            )}

            {/* Total + rule */}
            <div className="mt-3 pt-3 border-t border-cream-dark dark:border-navy-light flex flex-col gap-2">
              {matchingRule && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">מבצע: {matchingRule.name}</div>
                  <div className="text-xs text-emerald-600">
                    {matchingRule.discount_type === 'percent'
                      ? `${matchingRule.discount_value}% הנחה`
                      : `מחיר חבילה`}
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">סה״כ לתשלום</span>
                <div className="text-right">
                  {matchingRule && autoTotal !== finalTotal && (
                    <div className="text-xs text-muted line-through ltr">{formatPrice(autoTotal)}</div>
                  )}
                  <span className="text-lg font-semibold text-gold ltr">{formatPrice(finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="label">כתובת</div>
              {order.delivery_type !== 'pickup' && !editingAddress && (
                <button onClick={() => setEditingAddress(true)} className="text-muted hover:text-gold transition-colors">
                  <Edit2 size={13} />
                </button>
              )}
            </div>
            {editingAddress ? (
              <div className="flex flex-col gap-2">
                <input className="input text-sm" value={editAddress} onChange={e => setEditAddress(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <button onClick={saveAddress} disabled={savingAddress}
                    className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                    <Check size={12} />{savingAddress ? 'שומר...' : 'שמור'}
                  </button>
                  <button onClick={() => { setEditingAddress(false); setEditAddress(order.delivery_address || '') }}
                    className="btn-secondary text-xs px-4 py-1.5">ביטול</button>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {order.delivery_type === 'pickup' ? 'איסוף עצמי' : (order.delivery_address || '—')}
              </div>
            )}
          </div>

          {/* Shipping */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">משלוח — Run</div>
              {tracking && (
                <button onClick={async () => {
                  await fetch(`/api/orders/${order.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tracking_number: '' }),
                  })
                  setTracking('')
                  setTrackingEvents(null)
                  onUpdate({ ...order, items, customer, tracking_number: '' })
                }} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  הסר משלוח
                </button>
              )}
            </div>

            {tracking ? (
              /* Has shipment number */
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5">
                  <Truck size={15} className="text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-300 ltr">{tracking}</div>
                    <div className="text-xs text-muted">מספר משלוח ב-Run</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={`/api/shipments/${tracking}/label`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-100 dark:bg-blue-800/40 hover:bg-blue-200 px-2.5 py-1 rounded-full transition-colors">
                      <Printer size={11} /> תווית
                    </a>
                    <button onClick={() => loadTracking(tracking)} disabled={loadingTracking}
                      className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-100 dark:bg-blue-800/40 hover:bg-blue-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50">
                      {loadingTracking ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      מעקב
                    </button>
                  </div>
                </div>

                {/* Tracking events */}
                {trackingEvents && trackingEvents.length > 0 && (
                  <div className="flex flex-col gap-1 pr-1">
                    {trackingEvents.slice(0, 4).map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <div className={cn('w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0', i === 0 ? 'bg-blue-500' : 'bg-cream-dark dark:bg-navy-light')} />
                        <div className="flex-1">
                          <span className="text-navy dark:text-cream">{e.desc}</span>
                          <span className="text-muted mx-1">·</span>
                          <span className="text-muted ltr">{e.date} {e.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {trackingEvents && trackingEvents.length === 0 && (
                  <div className="text-xs text-muted text-center py-1">אין עדכוני מעקב עדיין</div>
                )}

                {/* Manual override */}
                <div className="flex gap-2 mt-1">
                  <input className="input flex-1 text-sm ltr" placeholder="שנה מספר מעקב..." value={tracking}
                    onChange={e => setTracking(e.target.value)} dir="ltr" />
                  <button onClick={() => save({ tracking_number: tracking })} className="btn-secondary text-xs px-3" disabled={saving}>שמור</button>
                </div>
              </div>
            ) : (
              /* No shipment yet */
              <div className="flex flex-col gap-2">
                {order.delivery_type !== 'pickup' && !showShipForm && (
                  <button onClick={() => setShowShipForm(true)}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2.5 text-sm font-medium transition-colors">
                    <Truck size={14} /> צור משלוח ב-Run
                  </button>
                )}

                {/* Address form */}
                {showShipForm && (
                  <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex flex-col gap-2 bg-blue-50/50 dark:bg-blue-900/10">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-400">פרטי כתובת למשלוח</div>
                    <div className="text-xs text-muted">
                      שם: <span className="font-medium text-navy dark:text-cream">{customer?.name}</span>
                      {' · '}טלפון: <span className="ltr font-medium text-navy dark:text-cream">{customer?.phone}</span>
                    </div>
                    <input className="input text-sm" placeholder="עיר *" value={shipCity} onChange={e => setShipCity(e.target.value)} autoFocus />
                    <input className="input text-sm" placeholder="רחוב *" value={shipStreet} onChange={e => setShipStreet(e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input text-sm" placeholder="בניין" value={shipBuilding} onChange={e => setShipBuilding(e.target.value)} />
                      <input className="input text-sm" placeholder="קומה" value={shipFloor} onChange={e => setShipFloor(e.target.value)} />
                      <input className="input text-sm" placeholder="דירה" value={shipApt} onChange={e => setShipApt(e.target.value)} />
                    </div>
                    {shipmentError && (
                      <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{shipmentError}</div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <button onClick={createRunShipment}
                        disabled={creatingShipment || !shipCity.trim() || !shipStreet.trim()}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50">
                        {creatingShipment ? <><Loader2 size={13} className="animate-spin" /> יוצר...</> : <><Truck size={13} /> שלח לRun</>}
                      </button>
                      <button onClick={() => { setShowShipForm(false); setShipmentError(null) }}
                        className="btn-secondary text-xs px-4">ביטול</button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input className="input flex-1 text-sm ltr" placeholder="או הכנס מספר מעקב ידנית..." value={tracking}
                    onChange={e => setTracking(e.target.value)} dir="ltr" />
                  <button onClick={() => save({ tracking_number: tracking })} className="btn-secondary text-xs px-3" disabled={saving || !tracking}>שמור</button>
                </div>
              </div>
            )}
          </div>

          {/* Invoice */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">חשבונית ירוקה</div>
              {invoiceUrl && (
                <button onClick={() => { setInvoiceId(null); setInvoiceUrl(null); setMorningInvoices(null); searchMorningInvoices() }}
                  className="text-xs text-muted hover:text-gold transition-colors">החלף</button>
              )}
            </div>

            {/* Linked invoice */}
            {invoiceUrl && !morningInvoices && (
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2.5">
                <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    {invoiceId ? `חשבונית #${invoiceId}` : 'חשבונית מצורפת'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={invoiceUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-100 dark:bg-emerald-800/40 hover:bg-emerald-200 px-2.5 py-1 rounded-full transition-colors">
                    <ExternalLink size={11} /> פתח PDF
                  </a>
                  {waInvoice && (
                    <a href={waInvoice} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-white bg-[#25D366] hover:bg-[#1EB858] px-2.5 py-1 rounded-full transition-colors">
                      <MessageCircle size={11} /> שלח
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Search results */}
            {morningInvoices && (() => {
              const customerName = customer?.name || ''
              const isMatch = (inv: any) => inv.clientName && customerName &&
                inv.clientName.trim() === customerName.trim()
              const matched = morningInvoices.filter(isMatch)
              const others  = morningInvoices.filter(i => !isMatch(i))
                .sort((a: any, b: any) => (a.clientName || '').localeCompare(b.clientName || '', 'he'))

              const renderRow = (inv: any, highlight: boolean) => (
                <button key={inv.id} onClick={() => linkInvoice(inv)} disabled={linkingId === inv.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-right w-full disabled:opacity-50',
                    highlight
                      ? 'border-gold/40 bg-gold/5 hover:border-gold hover:bg-gold/10'
                      : 'border-cream-dark dark:border-navy-light hover:border-gold hover:bg-gold/5'
                  )}>
                  <FileText size={14} className={highlight ? 'text-gold flex-shrink-0' : 'text-muted flex-shrink-0'} />
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm font-medium', highlight && 'text-gold')}>
                      {inv.clientName}
                    </div>
                    <div className="text-xs text-muted">
                      חשבונית #{inv.number} · {inv.amount ? formatPrice(inv.amount) : ''} · {inv.documentDate ? new Date(inv.documentDate).toLocaleDateString('he-IL') : ''}
                    </div>
                  </div>
                  {linkingId === inv.id
                    ? <Loader2 size={13} className="animate-spin text-gold" />
                    : <Check size={13} className="text-muted opacity-40" />
                  }
                </button>
              )

              return (
                <div className="flex flex-col gap-1">
                  {matched.length > 0 && (
                    <>
                      <div className="text-xs text-gold font-medium px-1 pt-1">התאמות עבור {customerName}</div>
                      {matched.map(inv => renderRow(inv, true))}
                      {others.length > 0 && <div className="text-xs text-muted px-1 pt-2 pb-0.5">שאר החשבוניות האחרונות</div>}
                    </>
                  )}
                  {others.map(inv => renderRow(inv, false))}
                  {morningInvoices.length === 0 && (
                    <div className="text-sm text-muted text-center py-3 border border-dashed border-cream-dark dark:border-navy-light rounded-xl">
                      לא נמצאו חשבוניות ב-Morning
                    </div>
                  )}
                  <button onClick={() => setMorningInvoices(null)} className="text-xs text-muted hover:text-navy dark:hover:text-cream text-center py-1.5">ביטול</button>
                </div>
              )
            })()}

            {/* No invoice yet — search button */}
            {!invoiceUrl && !morningInvoices && (
              <button onClick={searchMorningInvoices} disabled={searchingInvoices}
                className="flex items-center justify-center gap-2 w-full border border-dashed border-cream-dark dark:border-navy-light hover:border-gold hover:bg-gold/5 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-gold transition-colors disabled:opacity-50">
                {searchingInvoices
                  ? <><Loader2 size={14} className="animate-spin" /> מחפש ב-Morning...</>
                  : <><FileText size={14} /> חפש חשבונית ב-Morning</>
                }
              </button>
            )}

            {searchingInvoices && !morningInvoices && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" /> מחפש ב-Morning...
              </div>
            )}

            {invoiceError && (
              <div className="text-xs text-red-500 text-center mt-1">{invoiceError}</div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="label mb-1.5">הערות פנימיות</div>
            <textarea className="input min-h-[80px] resize-none" placeholder="הערות על ההזמנה..."
              value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => save({ notes })} />
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-2 pt-2 border-t border-cream-dark dark:border-navy-light">
            <div className="label mb-1">שליחה ב-WhatsApp</div>
            <a href={waReady} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EB858] text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
              <MessageCircle size={15} /> ההזמנה מוכנה
            </a>
            <a href={waShipped} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-navy hover:bg-navy-light dark:bg-cream dark:text-navy text-cream rounded-lg py-2.5 text-sm font-medium transition-colors">
              <Package size={15} /> עדכון משלוח
            </a>
          </div>

          {/* Meta */}
          <div className="text-xs text-muted space-y-0.5 pt-2 border-t border-cream-dark dark:border-navy-light">
            <div>נוצר: {formatDate(order.created_at)}</div>
            <div>עודכן: {formatDate(order.updated_at)}</div>
            {order.source && <div>מקור: {order.source}</div>}
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-cream-dark dark:border-navy-light">
            <button onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5 rounded-full transition-colors">
              <Trash2 size={14} /> מחיקת הזמנה
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Editable item card ────────────────────────────────────────────
function EditableItemCard({
  item,
  catalog,
  onSave,
  onDelete,
}: {
  item: OrderItem
  catalog: Product[]
  onSave: (patch: Partial<OrderItem>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)

  const [editProduct, setEditProduct] = useState<Product | null>(
    catalog.find(p => p.name === item.item_name) || null
  )
  const [editSize, setEditSize]       = useState(item.size || '')
  const [editColor, setEditColor]     = useState(item.color || '')
  const [editSignText, setEditSignText] = useState(item.sign_text || '')
  const [editFont, setEditFont]       = useState(item.font || '')
  const [editPrice, setEditPrice]     = useState(String(item.price || 0))

  // Sync product match when catalog loads
  useEffect(() => {
    if (catalog.length && !editProduct) {
      const found = catalog.find(p => p.name === item.item_name)
      if (found) setEditProduct(found)
    }
  }, [catalog])

  const handleProductChange = (id: string) => {
    const p = catalog.find(x => x.id === id) || null
    setEditProduct(p)
    setEditSize('')
    if (p) setEditPrice(p.sizes?.length ? '' : String(p.base_price))
  }

  const handleSizeChange = (label: string) => {
    setEditSize(label)
    if (editProduct) {
      const s = editProduct.sizes?.find(x => x.label === label)
      setEditPrice(s ? String(s.price) : String(editProduct.base_price))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      item_name:  editProduct?.name || item.item_name,
      model:      editProduct?.category || item.model,
      product_id: editProduct?.id || item.product_id,
      size:       editSize || null,
      color:      editColor || null,
      sign_text:  editSignText || null,
      sign_type:  item.sign_type || editProduct?.name || null,
      font:       editFont || null,
      price:      parseFloat(editPrice) || 0,
    })
    setSaving(false)
    setEditing(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete()
  }

  if (!editing) {
    return (
      <div className="bg-cream dark:bg-navy-deeper border border-cream-dark dark:border-navy-light rounded-lg px-3 py-2.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-cream-dark dark:bg-navy-light flex items-center justify-center flex-shrink-0 overflow-hidden">
          {item.product?.images?.[0]
            ? <img src={item.product.images[0]} alt={item.item_name} className="w-full h-full object-cover" />
            : <Package size={16} className="text-navy/40 dark:text-cream/30" strokeWidth={1.5} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.item_name}</div>
          <div className="text-xs text-muted mt-0.5">
            {[item.color, item.size && `${item.size} ס״מ`, item.font].filter(Boolean).join(' · ')}
          </div>
          {item.sign_text && (
            <div className="text-xs text-gold mt-0.5 font-medium">
              {item.sign_text.includes('\n') ? item.sign_text.replace('\n', '›') : item.sign_text}
            </div>
          )}
        </div>
        <div className="ltr text-sm font-medium flex-shrink-0">{formatPrice(item.price)}</div>
        <button onClick={() => setEditing(true)} className="text-muted hover:text-gold transition-colors flex-shrink-0">
          <Edit2 size={13} />
        </button>
        <button onClick={handleDelete} disabled={deleting} className="text-muted/40 hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-30">
          <Trash2 size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gold/30 rounded-xl p-3 flex flex-col gap-2.5 bg-cream/50 dark:bg-navy-deeper/50">
      {/* Product */}
      <div className="relative">
        <select className="input text-sm w-full appearance-none pr-3 pl-7 cursor-pointer"
          value={editProduct?.id || ''}
          onChange={e => handleProductChange(e.target.value)}>
          <option value="">— בחר מוצר —</option>
          {catalog.map(p => (
            <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.base_price)}</option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      </div>

      {/* Size */}
      {(editProduct?.sizes?.length ?? 0) > 0 && (
        <div className="relative">
          <select className="input text-sm w-full appearance-none pr-3 pl-7 cursor-pointer"
            value={editSize} onChange={e => handleSizeChange(e.target.value)}>
            <option value="">גודל — ללא</option>
            {editProduct!.sizes.map((s: ProductSize) => (
              <option key={s.label} value={s.label}>{s.label} — {formatPrice(s.price)}</option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        </div>
      )}

      {/* Color */}
      <ColorPicker value={editColor} onChange={setEditColor} />

      <input className="input text-sm" placeholder="טקסט על השלט" value={editSignText} onChange={e => setEditSignText(e.target.value)} maxLength={20} />

      <div className="relative">
        <select className="input text-sm w-full appearance-none pr-3 pl-7" value={editFont} onChange={e => setEditFont(e.target.value)}>
          <option value="">פונט — ללא</option>
          {(() => {
            const isHeb = /[\u0590-\u05FF]/.test(editSignText)
            const hebFonts = ['Heebo','Rubik','Bona Nova','Frank Ruhl Libre','Alef','Karantina']
            const filtered = editSignText.trim()
              ? FONTS.filter(f => isHeb ? hebFonts.includes(f) : !hebFonts.includes(f))
              : FONTS
            return filtered.map(f => <option key={f} value={f}>{f}</option>)
          })()}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      </div>

      <input className="input text-sm ltr" placeholder="מחיר (₪)" value={editPrice}
        onChange={e => setEditPrice(e.target.value)} type="number" min="0" dir="ltr" />

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
          <Check size={12} />{saving ? 'שומר...' : 'שמור'}
        </button>
        <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-4 py-1.5">ביטול</button>
      </div>
    </div>
  )
}
