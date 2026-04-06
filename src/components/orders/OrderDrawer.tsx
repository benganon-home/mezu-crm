'use client'

import { useState } from 'react'
import { X, MessageCircle, Edit2, Plus, Trash2, Package, AlertTriangle, Check, ChevronDown } from 'lucide-react'
import { Order, OrderItem, OrderStatus, ALL_STATUSES, STATUS_CONFIG, ITEM_COLOR_MAP, FONTS } from '@/types'
import { formatDate, formatPrice, cn } from '@/lib/utils'
import { getWaLink, getInvoiceWaLink } from '@/lib/whatsapp'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import { useDrawerAnimation } from '@/hooks/useDrawerAnimation'

interface Props {
  order: Order
  onClose: () => void
  onUpdate: (order: Order) => void
  onDelete?: (orderId: string) => void
}

export function OrderDrawer({ order, onClose, onUpdate, onDelete }: Props) {
  const { visible, close } = useDrawerAnimation(onClose)
  const [saving, setSaving]           = useState(false)
  const [status, setStatus]           = useState<OrderStatus>(order.status)
  const [notes, setNotes]             = useState(order.notes || '')
  const [tracking, setTracking]       = useState(order.tracking_number || '')
  const [editingItems, setEditingItems] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [addingItem, setAddingItem]           = useState(false)
  const [newItem, setNewItem]                 = useState({ item_name: '', color: '', sign_text: '', font: '', price: '' })
  const [savingItem, setSavingItem]           = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [editName, setEditName]       = useState(order.customer?.name || '')
  const [editPhone, setEditPhone]     = useState(order.customer?.phone || '')
  const [savingCustomer, setSavingCustomer] = useState(false)
  const customer = order.customer

  const save = async (patch: Partial<Order>) => {
    setSaving(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const updated = await res.json()
    onUpdate({ ...order, ...updated })
    setSaving(false)
  }

  const onStatusChange = async (s: OrderStatus) => {
    setStatus(s)
    await save({ status: s })
  }

  const saveCustomer = async () => {
    setSavingCustomer(true)
    const normalizedPhone = editPhone.replace(/\D/g, '').replace(/^972/, '0')

    // Look up existing customer by phone
    const lookupRes = await fetch(`/api/customers?phone=${encodeURIComponent(normalizedPhone)}`)
    const lookupJson = await lookupRes.json()
    const existing = (lookupJson.data || [])[0]

    let customerId: string

    if (existing) {
      // Update their name if changed
      if (existing.name !== editName) {
        await fetch(`/api/customers/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName }),
        })
      }
      customerId = existing.id
    } else {
      // Create new customer
      const createRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: normalizedPhone }),
      })
      const newCustomer = await createRes.json()
      customerId = newCustomer.id
    }

    // Update order with new customer_id
    const orderRes = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId }),
    })
    const updated = await orderRes.json()
    onUpdate({
      ...order,
      ...updated,
      customer: { ...(order.customer!), id: customerId, name: editName, phone: normalizedPhone },
    })
    setEditingCustomer(false)
    setSavingCustomer(false)
  }

  const addItem = async () => {
    if (!newItem.item_name.trim()) return
    setSavingItem(true)
    const res = await fetch('/api/order-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id:  order.id,
        item_name: newItem.item_name.trim(),
        color:     newItem.color || null,
        sign_text: newItem.sign_text || null,
        font:      newItem.font || null,
        price:     parseFloat(newItem.price) || 0,
        status:    'received',
      }),
    })
    const created = await res.json()
    onUpdate({ ...order, items: [...(order.items || []), created] })
    setNewItem({ item_name: '', color: '', sign_text: '', font: '', price: '' })
    setAddingItem(false)
    setSavingItem(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await fetch(`/api/orders/${order.id}`, { method: 'DELETE' })
    onDelete?.(order.id)
    close()
  }

  const totalPrice = (order.items || []).reduce((sum, i) => sum + (i.price || 0), 0) || order.total_price
  const waReady    = customer ? getWaLink(customer, 'order_ready',  { itemSummary: order.items?.map(i => i.item_name).join(', ') }) : '#'
  const waShipped  = customer ? getWaLink(customer, 'order_shipped', { trackingNumber: tracking, invoiceUrl: order.invoice_url || undefined }) : '#'
  const waInvoice  = customer && order.invoice_url ? getInvoiceWaLink(customer, order.invoice_url) : null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={close}
      />

      {/* ── Delete confirmation dialog ── */}
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
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-full transition-colors disabled:opacity-50"
              >
                {deleting ? 'מוחק...' : 'כן, מחק'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 btn-secondary py-2.5"
              >
                ביטול
              </button>
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
                  <input
                    className="input text-sm"
                    placeholder="שם לקוח"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                  />
                  <input
                    className="input text-sm ltr"
                    placeholder="טלפון"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    dir="ltr"
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={saveCustomer}
                      disabled={savingCustomer || !editName.trim() || !editPhone.trim()}
                      className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check size={12} />
                      {savingCustomer ? 'שומר...' : 'שמור'}
                    </button>
                    <button
                      onClick={() => { setEditingCustomer(false); setEditName(customer?.name || ''); setEditPhone(customer?.phone || '') }}
                      className="btn-secondary text-xs px-4 py-1.5"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{customer?.name}</span>
                    <button
                      onClick={() => setEditingCustomer(true)}
                      className="text-muted hover:text-gold transition-colors"
                      title="עריכת פרטי לקוח"
                    >
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
            <button onClick={close} className="text-muted hover:text-navy dark:hover:text-cream p-1 rounded shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-6">

          {/* Status */}
          <div>
            <div className="label mb-2">סטטוס הזמנה</div>
            <div className="flex gap-2 flex-wrap">
              {ALL_STATUSES.filter(s => s !== 'cancelled').map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={cn(
                    'badge cursor-pointer transition-all',
                    STATUS_CONFIG[s].bg,
                    STATUS_CONFIG[s].text,
                    status === s ? 'ring-2 ring-offset-1 ring-current font-semibold scale-105' : 'opacity-60 hover:opacity-90'
                  )}
                >
                  <span className={cn('badge-dot', STATUS_CONFIG[s].dot)} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">מוצרים בהזמנה ({(order.items || []).length})</div>
              <button
                onClick={() => setEditingItems(e => !e)}
                className="text-xs text-gold flex items-center gap-1 hover:underline"
              >
                <Edit2 size={11} /> עריכה
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {(order.items || []).map(item => (
                <ItemCard key={item.id} item={item} editing={editingItems} />
              ))}
            </div>

            {editingItems && !addingItem && (
              <button
                onClick={() => setAddingItem(true)}
                className="mt-2 flex items-center gap-1.5 text-xs text-gold hover:underline"
              >
                <Plus size={12} /> הוסף פריט
              </button>
            )}

            {addingItem && (
              <div className="mt-3 border border-cream-dark dark:border-navy-light rounded-xl p-3 flex flex-col gap-2.5 bg-cream/50 dark:bg-navy-deeper/50">
                <div className="label text-xs mb-0">פריט חדש</div>

                <input
                  className="input text-sm"
                  placeholder="שם המוצר *"
                  value={newItem.item_name}
                  onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
                  autoFocus
                />

                <div className="relative">
                  <select
                    className="input text-sm w-full appearance-none pr-3 pl-7 cursor-pointer"
                    value={newItem.color}
                    onChange={e => setNewItem(p => ({ ...p, color: e.target.value }))}
                  >
                    <option value="">צבע — ללא</option>
                    {Object.keys(ITEM_COLOR_MAP).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>

                <input
                  className="input text-sm"
                  placeholder="טקסט על השלט"
                  value={newItem.sign_text}
                  onChange={e => setNewItem(p => ({ ...p, sign_text: e.target.value }))}
                />

                <select
                  className="input text-sm"
                  value={newItem.font}
                  onChange={e => setNewItem(p => ({ ...p, font: e.target.value }))}
                >
                  <option value="">פונט —</option>
                  {FONTS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                <input
                  className="input text-sm ltr"
                  placeholder="מחיר (₪)"
                  value={newItem.price}
                  onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                  type="number"
                  min="0"
                  dir="ltr"
                />

                <div className="flex gap-2">
                  <button
                    onClick={addItem}
                    disabled={savingItem || !newItem.item_name.trim()}
                    className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check size={12} />
                    {savingItem ? 'שומר...' : 'הוסף'}
                  </button>
                  <button
                    onClick={() => { setAddingItem(false); setNewItem({ item_name: '', color: '', sign_text: '', font: '', price: '' }) }}
                    className="btn-secondary text-xs px-4 py-1.5"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-cream-dark dark:border-navy-light">
              <span className="text-sm text-muted">סה״כ לתשלום</span>
              <span className="text-lg font-semibold text-gold ltr">{formatPrice(totalPrice)}</span>
            </div>
          </div>

          {/* Address */}
          <div>
            <div className="label mb-1">כתובת</div>
            <div className="text-sm">
              {order.delivery_type === 'pickup'
                ? 'איסוף עצמי'
                : order.delivery_address || '—'
              }
            </div>
          </div>

          {/* Tracking */}
          <div>
            <div className="label mb-1.5">מספר מעקב משלוח</div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="הכנס מספר מעקב..."
                value={tracking}
                onChange={e => setTracking(e.target.value)}
              />
              <button
                onClick={() => save({ tracking_number: tracking })}
                className="btn-secondary text-xs px-3"
                disabled={saving}
              >
                שמור
              </button>
            </div>
          </div>

          {/* Invoice */}
          <div>
            <div className="label mb-2">חשבונית ירוקה</div>
            {order.invoice_id ? (
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">חשבונית #{order.invoice_id}</div>
                  <div className="text-xs text-emerald-600">{formatPrice(totalPrice)}</div>
                </div>
                {waInvoice && (
                  <a href={waInvoice} target="_blank" rel="noreferrer"
                    className="text-xs text-emerald-700 hover:underline flex items-center gap-1">
                    <MessageCircle size={12} /> שלח
                  </a>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-cream-dark dark:border-navy-light rounded-lg px-3 py-2.5 text-sm text-muted">
                אין חשבונית — הפקה תתבצע בממשק חשבונית ירוקה
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="label mb-1.5">הערות פנימיות</div>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="הערות על ההזמנה..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => save({ notes })}
            />
          </div>

          {/* WhatsApp actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-cream-dark dark:border-navy-light">
            <div className="label mb-1">שליחה ב-WhatsApp</div>
            <a href={waReady} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EB858] text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
              <MessageCircle size={15} />
              ההזמנה מוכנה
            </a>
            <a href={waShipped} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-navy hover:bg-navy-light dark:bg-cream dark:text-navy text-cream rounded-lg py-2.5 text-sm font-medium transition-colors">
              <Package size={15} />
              עדכון משלוח
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
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5 rounded-full transition-colors"
            >
              <Trash2 size={14} />
              מחיקת הזמנה
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ItemCard({ item, editing }: { item: OrderItem; editing: boolean }) {
  return (
    <div className="bg-cream dark:bg-navy-deeper border border-cream-dark dark:border-navy-light rounded-lg px-3 py-2.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-md bg-cream-dark dark:bg-navy-light flex items-center justify-center flex-shrink-0">
        <Package size={16} className="text-navy/40 dark:text-cream/30" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.item_name}</div>
        <div className="text-xs text-muted mt-0.5">
          {[item.color, item.size, item.font].filter(Boolean).join(' · ')}
        </div>
        {item.sign_text && (
          <div className="text-xs text-gold mt-0.5 font-medium">✏️ {item.sign_text}</div>
        )}
      </div>
      <div className="ltr text-sm font-medium flex-shrink-0">{formatPrice(item.price)}</div>
      {editing && (
        <button className="text-muted hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
