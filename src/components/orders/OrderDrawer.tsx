'use client'

import { useState } from 'react'
import { X, MessageCircle, FileText, Edit2, Plus, Trash2, Package } from 'lucide-react'
import { Order, OrderItem, OrderStatus, ALL_STATUSES, STATUS_CONFIG } from '@/types'
import { formatDate, formatPrice, cn } from '@/lib/utils'
import { getWaLink, getInvoiceWaLink } from '@/lib/whatsapp'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CopyButton } from '@/components/ui/CopyButton'

interface Props {
  order: Order
  onClose: () => void
  onUpdate: (order: Order) => void
}

export function OrderDrawer({ order, onClose, onUpdate }: Props) {
  const [saving, setSaving]   = useState(false)
  const [status, setStatus]   = useState<OrderStatus>(order.status)
  const [notes, setNotes]     = useState(order.notes || '')
  const [tracking, setTracking] = useState(order.tracking_number || '')
  const [editingItems, setEditingItems] = useState(false)
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

  const totalPrice = (order.items || []).reduce((sum, i) => sum + (i.price || 0), 0) || order.total_price
  const waReady    = customer ? getWaLink(customer, 'order_ready',  { itemSummary: order.items?.map(i => i.item_name).join(', ') }) : '#'
  const waShipped  = customer ? getWaLink(customer, 'order_shipped', { trackingNumber: tracking, invoiceUrl: order.invoice_url || undefined }) : '#'
  const waInvoice  = customer && order.invoice_url ? getInvoiceWaLink(customer, order.invoice_url) : null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="drawer open">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-navy-dark border-b border-cream-dark dark:border-navy-light px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-lg">{customer?.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="ltr text-sm text-muted">{customer?.phone}</span>
                <CopyButton text={customer?.phone || ''} />
              </div>
            </div>
            <button onClick={onClose} className="text-muted hover:text-navy dark:hover:text-cream p-1 rounded">
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

            {editingItems && (
              <button className="mt-2 flex items-center gap-1.5 text-xs text-gold hover:underline">
                <Plus size={12} /> הוסף פריט
              </button>
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
