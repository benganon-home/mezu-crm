'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Check, Trash2, Loader2, MessageCircle } from 'lucide-react'
import { formatPrice, buildWaLink } from '@/lib/utils'

interface PendingData {
  customer_name?: string
  phone?:         string
  mezuzah_model?: string
  sign_type?:     string
  extra_qty?:     string
  extra_model?:   string
  total_price?:   string
  address?:       string
  sign_text?:     string
  mishpachat?:    string
  font?:          string
  color?:         string
  mezuzah_size?:  string
}

interface PendingRecord {
  key:  string
  data: PendingData
}

function productCount(d: PendingData): number {
  let n = 0
  if (d.mezuzah_model) n++
  if (d.sign_type)     n++
  n += parseInt(d.extra_qty || '0') || 0
  return n
}

export function PendingOrdersBanner({ onOrderAdded }: { onOrderAdded: () => void }) {
  const [records, setRecords]     = useState<PendingRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState<string | null>(null)
  const [errors, setErrors]       = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/pending-orders')
      .then(r => r.ok ? r.json() : [])
      .then(setRecords)
      .finally(() => setLoading(false))
  }, [])

  if (loading || records.length === 0) return null

  const handleAdd = async (r: PendingRecord) => {
    setBusy(r.key)
    setErrors(prev => { const { [r.key]: _, ...rest } = prev; return rest })
    const res = await fetch(`/api/pending-orders/${encodeURIComponent(r.key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:  r.data.customer_name  || '',
        phone:          r.data.phone          || r.key,
        address:        r.data.address        || '',
        sign_text:      r.data.sign_text      || '',
        mishpachat:     r.data.mishpachat     || '',
        font:           r.data.font           || null,
        sign_type:      r.data.sign_type      || null,
        color:          r.data.color          || null,
        mezuzah_model:  r.data.mezuzah_model  || null,
        mezuzah_size:   r.data.mezuzah_size   || null,
        extra_qty:      r.data.extra_qty      || '0',
        extra_model:    r.data.extra_model    || null,
        total_price:    r.data.total_price    || '0',
      }),
    })
    setBusy(null)
    if (res.ok) {
      setRecords(prev => prev.filter(x => x.key !== r.key))
      onOrderAdded()
    } else {
      const err = await res.json().catch(() => ({}))
      setErrors(prev => ({ ...prev, [r.key]: err.error || `שגיאה ${res.status}` }))
    }
  }

  const handleDelete = async (key: string) => {
    setBusy(key)
    setErrors(prev => { const { [key]: _, ...rest } = prev; return rest })
    const res = await fetch(`/api/pending-orders/${encodeURIComponent(key)}`, { method: 'DELETE' })
    setBusy(null)
    if (res.ok) {
      setRecords(prev => prev.filter(x => x.key !== key))
    } else {
      const err = await res.json().catch(() => ({}))
      setErrors(prev => ({ ...prev, [key]: err.error || `שגיאה במחיקה (${res.status})` }))
    }
  }

  return (
    <div className="surface overflow-hidden" style={{ borderColor: '#FED7AA' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-orange-50 dark:bg-orange-950/30" style={{ borderColor: '#FED7AA' }}>
        <AlertCircle size={14} className="text-orange-500 shrink-0" />
        <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
          {records.length} הזמנות ממתינות
        </span>
      </div>

      {/* Rows */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] font-medium text-muted border-b border-cream-dark dark:border-navy-light">
            <th className="px-4 py-2 text-right font-medium">שם לקוח</th>
            <th className="px-4 py-2 text-right font-medium ltr">טלפון</th>
            <th className="px-4 py-2 text-right font-medium">פריטים</th>
            <th className="px-4 py-2 text-right font-medium ltr">מחיר</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {records.map(r => {
            const isBusy = busy === r.key
            const error  = errors[r.key]
            return (
              <tr key={r.key} className="border-b last:border-0 border-cream-dark dark:border-navy-light hover:bg-cream/50 dark:hover:bg-navy-light/20">
                <td className="px-4 py-3 font-medium">
                  {r.data.customer_name || '—'}
                  {error && (
                    <div className="text-[11px] text-red-500 mt-1 font-normal">{error}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted ltr">{r.key}</td>
                <td className="px-4 py-3 text-muted">{productCount(r.data)} פריטים</td>
                <td className="px-4 py-3 font-medium text-gold ltr">
                  {formatPrice(parseFloat(r.data.total_price || '0'))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <a
                      href={buildWaLink(r.data.phone || r.key, `שלום ${r.data.customer_name || ''}! 😊\nראינו שהתחלת הזמנה ב-MEZU אך טרם השלמת אותה.\nנשמח לעזור! יש שאלות? 🙏`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs py-1.5 px-3 flex items-center gap-1.5 border border-green-200 text-green-600 rounded-full hover:bg-green-50 transition-colors"
                    >
                      <MessageCircle size={11} />
                      וואטסאפ
                    </a>
                    <button
                      onClick={() => handleAdd(r)}
                      disabled={isBusy}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      הוסף
                    </button>
                    <button
                      onClick={() => handleDelete(r.key)}
                      disabled={isBusy}
                      className="text-xs py-1.5 px-3 flex items-center gap-1.5 border border-red-200 text-red-600 rounded-full hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      מחק
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
