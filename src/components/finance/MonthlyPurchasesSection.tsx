'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Copy, Loader2 } from 'lucide-react'
import { ExpenseCategory } from '@/types'
import { formatPrice, cn } from '@/lib/utils'

interface Purchase {
  id:           string
  month:        string
  name:         string
  category_id:  string | null
  quantity:     number
  unit_price:   number
  notes:        string | null
  display_order: number
  category:     ExpenseCategory | null
}

interface Props {
  month: string                                       // 'YYYY-MM'
  vatMode: 'net' | 'gross'
  onTotalChange?: (total: number) => void
}

export function MonthlyPurchasesSection({ month, vatMode, onTotalChange }: Props) {
  const [rows, setRows]               = useState<Purchase[]>([])
  const [categories, setCategories]   = useState<ExpenseCategory[]>([])
  const [loading, setLoading]         = useState(true)
  const [copying, setCopying]         = useState(false)
  const [copyError, setCopyError]     = useState<string | null>(null)
  const [adding, setAdding]           = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/monthly-purchases?month=${month}`)
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [month])

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/expense-categories')
    const data = await res.json()
    setCategories(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { fetchCategories() }, [fetchCategories])

  // Tell parent the total (gross) so /finance can show it in the period summary.
  useEffect(() => {
    const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0)
    onTotalChange?.(total)
  }, [rows, onTotalChange])

  const handleCopy = async () => {
    setCopying(true)
    setCopyError(null)
    const res = await fetch('/api/monthly-purchases/copy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ month }),
    })
    const data = await res.json()
    setCopying(false)
    if (!res.ok) { setCopyError(data.error || 'שגיאה בהעתקה'); return }
    fetchRows()
  }

  const handleAdd = async () => {
    setAdding(true)
    const res = await fetch('/api/monthly-purchases', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ month, name: 'פריט חדש', quantity: 1, unit_price: 0, display_order: rows.length + 100 }),
    })
    const newRow = await res.json()
    setAdding(false)
    if (res.ok) setRows(prev => [...prev, newRow])
  }

  const handleUpdate = async (id: string, patch: Partial<Purchase>) => {
    // Optimistic
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } as Purchase : r))
    const res = await fetch(`/api/monthly-purchases/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) setRows(prev => prev.map(r => r.id === id ? data : r))
  }

  const handleDelete = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/monthly-purchases/${id}`, { method: 'DELETE' })
  }

  const totalGross = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0)
  const totalShown = vatMode === 'net' ? totalGross / 1.18 : totalGross

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="label">פריטי רכש חודשיים</div>
          <p className="text-[11px] text-muted mt-0.5">מעקב ידני אחרי הוצאות שמשתנות מחודש לחודש (פילמנט, שקיות, מדבקות וכו׳)</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          פריט חדש
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-muted text-center py-6">טוען...</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="text-sm text-muted">אין עדיין פריטים לחודש הזה</div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={copying}
              className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {copying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
              העתק מהחודש הקודם
            </button>
            <button onClick={handleAdd} className="btn-secondary text-sm flex items-center gap-1.5">
              <Plus size={13} /> התחל מאפס
            </button>
          </div>
          {copyError && <div className="text-xs text-red-500">{copyError}</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_140px_90px_110px_110px_32px] gap-2 text-[10px] text-muted uppercase tracking-wide font-medium px-2">
            <div>שם פריט</div>
            <div>קטגוריה</div>
            <div className="text-center">כמות</div>
            <div className="text-left">מחיר ליחידה</div>
            <div className="text-left">סה״כ</div>
            <div />
          </div>

          {rows.map(r => {
            const lineTotal = (Number(r.quantity) || 0) * (Number(r.unit_price) || 0)
            const shown = vatMode === 'net' ? lineTotal / 1.18 : lineTotal
            return (
              <div
                key={r.id}
                className="grid grid-cols-2 md:grid-cols-[1fr_140px_90px_110px_110px_32px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-cream dark:hover:bg-navy-light/40 transition-colors"
              >
                <input
                  className="input text-sm py-1.5 md:col-span-1 col-span-2"
                  value={r.name}
                  onChange={e => setRows(prev => prev.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))}
                  onBlur={e => handleUpdate(r.id, { name: e.target.value })}
                  placeholder="שם פריט"
                />
                <select
                  className="input text-sm py-1.5"
                  value={r.category_id || ''}
                  onChange={e => handleUpdate(r.id, { category_id: e.target.value || null })}
                >
                  <option value="">ללא</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name_he}</option>)}
                </select>
                <input
                  className="input text-sm py-1.5 text-center ltr"
                  type="number" min="0" step="0.01" dir="ltr"
                  value={r.quantity ?? 0}
                  onChange={e => setRows(prev => prev.map(x => x.id === r.id ? { ...x, quantity: Number(e.target.value) } : x))}
                  onBlur={e => handleUpdate(r.id, { quantity: Number(e.target.value) })}
                />
                <input
                  className="input text-sm py-1.5 text-left ltr"
                  type="number" min="0" step="0.01" dir="ltr"
                  value={r.unit_price ?? 0}
                  onChange={e => setRows(prev => prev.map(x => x.id === r.id ? { ...x, unit_price: Number(e.target.value) } : x))}
                  onBlur={e => handleUpdate(r.id, { unit_price: Number(e.target.value) })}
                />
                <div className="text-sm font-medium ltr tabular-nums text-left">
                  {formatPrice(shown)}
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-muted hover:text-red-500 p-1 rounded transition-colors"
                  aria-label="מחק"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}

          {/* Total row */}
          <div className="grid grid-cols-2 md:grid-cols-[1fr_140px_90px_110px_110px_32px] gap-2 items-center px-2 pt-3 mt-1 border-t border-cream-dark dark:border-navy-light">
            <div className="md:col-span-4 col-span-1 text-sm font-medium">סה״כ פריטי החודש</div>
            <div className="ltr text-base font-semibold text-gold tabular-nums text-left">{formatPrice(totalShown)}</div>
            <div />
          </div>
        </div>
      )}
    </div>
  )
}
