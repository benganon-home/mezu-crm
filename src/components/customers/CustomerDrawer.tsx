'use client'

import { useState, useEffect } from 'react'
import { X, MessageCircle, Bell, Package, ExternalLink } from 'lucide-react'
import { Customer, Order } from '@/types'
import { formatDate, formatPrice, formatPhone, buildWaLink, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import { useDrawerAnimation } from '@/hooks/useDrawerAnimation'

interface Props {
  customer: Customer
  onClose: () => void
  onUpdate: (c: Customer) => void
}

export function CustomerDrawer({ customer, onClose, onUpdate }: Props) {
  const { visible, close } = useDrawerAnimation(onClose)
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes]     = useState(customer.notes || '')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    fetch(`/api/customers/${customer.id}`)
      .then(r => r.json())
      .then(d => { setOrders(d.orders || []); setLoading(false) })
  }, [customer.id])

  const saveNotes = async () => {
    setSaving(true)
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    const updated = await res.json()
    onUpdate({ ...customer, ...updated })
    setSaving(false)
  }

  const totalSpent  = orders.reduce((s, o) => s + (o.total_price || 0), 0)
  const waBase      = buildWaLink(customer.phone, `שלום ${customer.name}, `)
  const activeOrders = orders.filter(o => !['shipped', 'cancelled'].includes(o.status))

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={close}
      />
      <div className={cn('drawer', visible && 'open')}>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-navy-dark border-b border-cream-dark dark:border-navy-light px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-navy/10 dark:bg-cream/10 flex items-center justify-center text-lg font-semibold text-navy dark:text-cream flex-shrink-0">
                {customer.name.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-lg leading-tight">{customer.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="ltr text-sm text-muted">{formatPhone(customer.phone)}</span>
                  <CopyButton text={customer.phone} />
                </div>
              </div>
            </div>
            <button onClick={close} className="text-muted hover:text-navy dark:hover:text-cream p-1 rounded">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 flex flex-col gap-6">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-cream dark:bg-navy-deeper rounded-lg p-3 text-center">
              <div className="text-xl font-semibold">{orders.length}</div>
              <div className="text-xs text-muted mt-0.5">הזמנות</div>
            </div>
            <div className="bg-cream dark:bg-navy-deeper rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-gold ltr">{formatPrice(totalSpent)}</div>
              <div className="text-xs text-muted mt-0.5">סה״כ</div>
            </div>
            <div className="bg-cream dark:bg-navy-deeper rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-amber-600">{activeOrders.length}</div>
              <div className="text-xs text-muted mt-0.5">פעילות</div>
            </div>
          </div>

          {/* Address */}
          {customer.address && (
            <div>
              <div className="label mb-1">כתובת</div>
              <div className="text-sm flex items-start gap-2">
                <span>{customer.address}</span>
                <CopyButton text={customer.address} />
              </div>
            </div>
          )}

          {/* Orders history */}
          <div>
            <div className="label mb-2">היסטוריית הזמנות</div>
            {loading ? (
              <div className="text-sm text-muted">טוען...</div>
            ) : orders.length === 0 ? (
              <div className="text-sm text-muted">אין הזמנות</div>
            ) : (
              <div className="flex flex-col gap-2">
                {orders
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(order => (
                    <div key={order.id}
                      className="bg-cream dark:bg-navy-deeper border border-cream-dark dark:border-navy-light rounded-lg px-3 py-2.5 flex items-center gap-3">
                      <Package size={14} className="text-muted flex-shrink-0" strokeWidth={1.5} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted ltr">{formatDate(order.created_at)}</div>
                        <div className="text-sm truncate mt-0.5">
                          {(order.items || []).map(i => i.item_name).join(', ') || `הזמנה`}
                        </div>
                      </div>
                      <StatusBadge status={order.status} size="sm" />
                      <span className="ltr text-sm font-medium flex-shrink-0">{formatPrice(order.total_price)}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="label mb-1.5">הערות</div>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="הערות על הלקוח..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={saveNotes}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-cream-dark dark:border-navy-light">
            <div className="label mb-1">פעולות מהירות</div>
            <a
              href={waBase}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EB858] text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              <MessageCircle size={15} />
              פתח שיחת WhatsApp
            </a>
            <button className="btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm">
              <Bell size={14} strokeWidth={1.5} />
              הוסף תזכורת
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs text-muted pt-2 border-t border-cream-dark dark:border-navy-light">
            לקוח מאז: {formatDate(customer.created_at)}
          </div>
        </div>
      </div>
    </>
  )
}
