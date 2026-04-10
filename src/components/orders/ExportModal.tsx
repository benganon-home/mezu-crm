'use client'

import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface Props {
  onClose: () => void
}

function toCSV(rows: string[][]): string {
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '').replace(/"/g, '""')
      return /[",\n\r]/.test(s) ? `"${s}"` : s
    }).join(',')
  ).join('\n')
}

function downloadCSV(content: string, filename: string) {
  const bom = '\uFEFF' // UTF-8 BOM for Excel Hebrew support
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportModal({ onClose }: Props) {
  const today     = new Date().toISOString().split('T')[0]
  const monthAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo, setDateTo]     = useState(today)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/orders?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      const json = await res.json()
      const orders = json.data || json || []

      if (!orders.length) {
        setError('לא נמצאו הזמנות בטווח התאריכים הנבחר')
        setLoading(false)
        return
      }

      // One row per order-item
      const headers = ['תאריך', 'שם לקוח', 'טלפון', 'כתובת', 'סטטוס הזמנה', 'מוצר', 'קטגוריה', 'גודל', 'צבע', 'טקסט', 'פונט', 'מחיר פריט', 'סה"כ הזמנה']
      const rows: string[][] = [headers]

      for (const order of orders) {
        const date     = new Date(order.created_at).toLocaleDateString('he-IL')
        const name     = order.customer?.name || ''
        const phone    = order.customer?.phone || ''
        const address  = order.delivery_type === 'pickup' ? 'איסוף עצמי' : (order.delivery_address || '')
        const status   = order.status
        const items    = order.items || []
        const total    = items.reduce((s: number, i: any) => s + (i.price || 0), 0) || order.total_price || 0

        if (items.length === 0) {
          rows.push([date, name, phone, address, status, '', '', '', '', '', '', '', String(total)])
        } else {
          items.forEach((item: any, idx: number) => {
            rows.push([
              date, name, phone, address, status,
              item.item_name || '',
              item.model || '',
              item.size ? `${item.size} ס"מ` : '',
              item.color || '',
              item.sign_text || '',
              item.font || '',
              String(item.price || 0),
              idx === 0 ? String(total) : '', // total only on first item row
            ])
          })
        }
      }

      const filename = `mezu-orders-${dateFrom}-to-${dateTo}.csv`
      downloadCSV(toCSV(rows), filename)
      onClose()
    } catch {
      setError('שגיאה בייצוא — נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-navy-dark rounded-2xl shadow-2xl p-6 w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">ייצוא הזמנות ל-Excel</h3>
          <button onClick={onClose} className="text-muted hover:text-navy dark:hover:text-cream p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-3 mb-5">
          <div>
            <div className="label mb-1.5">מתאריך</div>
            <input
              type="date"
              className="input w-full ltr"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <div className="label mb-1.5">עד תאריך</div>
            <input
              type="date"
              className="input w-full ltr"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-500 mb-4 text-center">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={loading || !dateFrom || !dateTo}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> מייצא...</>
              : <><Download size={15} /> ייצוא CSV</>
            }
          </button>
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">ביטול</button>
        </div>

        <p className="text-xs text-muted text-center mt-3">הקובץ נפתח ב-Excel עם תמיכה בעברית</p>
      </div>
    </div>
  )
}
