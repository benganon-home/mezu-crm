'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ArrowRight, Trash2, Loader2, Save } from 'lucide-react'
import { ExpenseCategory, RecurringExpense, ExpenseCadence } from '@/types'
import { formatPrice, cn } from '@/lib/utils'

const CADENCE_LABEL: Record<ExpenseCadence, string> = {
  monthly: 'חודשי',
  quarterly: 'רבעוני',
  yearly: 'שנתי',
}

export default function RecurringExpensesPage() {
  const [items, setItems]           = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [editing, setEditing]       = useState<RecurringExpense | null | undefined>(undefined)
  const [loading, setLoading]       = useState(true)

  const load = async () => {
    setLoading(true)
    const [iRes, cRes] = await Promise.all([
      fetch('/api/recurring-expenses'),
      fetch('/api/expense-categories'),
    ])
    setItems(await iRes.json())
    setCategories(await cRes.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('למחוק את התבנית?')) return
    setItems(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Link href="/expenses" className="text-muted hover:text-navy dark:hover:text-cream"><ArrowRight size={16} /></Link>
          <div>
            <h1>הוצאות קבועות</h1>
            <p className="text-xs text-muted mt-0.5">{items.length} תבניות</p>
          </div>
        </div>
        <button onClick={() => setEditing(null)} className="btn-primary flex items-center gap-2">
          <Plus size={14} strokeWidth={1.5} /> תבנית חדשה
        </button>
      </div>

      {loading && <div className="text-sm text-muted">טוען...</div>}

      {!loading && items.length === 0 && (
        <div className="surface text-center py-12 text-muted text-sm">
          אין עדיין תבניות. הוסף את ההוצאות החודשיות הקבועות שלך כדי לקבל התראה אם פספסת רשומה.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map(r => (
          <div key={r.id} className="surface px-3 py-3 flex items-center gap-3" onClick={() => setEditing(r)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{r.vendor}</span>
                {r.category && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: r.category.color + '22', color: r.category.color }}>
                    {r.category.name_he}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5 flex flex-wrap items-center gap-2">
                <span>{CADENCE_LABEL[r.cadence]}</span>
                {r.expected_day_of_month && <span>· יום {r.expected_day_of_month} בחודש</span>}
                {r.expected_amount && <span className="ltr">· {formatPrice(Number(r.expected_amount))}</span>}
                {!r.is_active && <span className="text-red-500">· כבוי</span>}
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); handleDelete(r.id) }} className="text-muted hover:text-red-500 p-1.5">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {editing !== undefined && (
        <RecurringForm
          template={editing}
          categories={categories}
          onClose={() => setEditing(undefined)}
          onSaved={t => {
            setItems(prev => {
              const exists = prev.some(x => x.id === t.id)
              return exists ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev]
            })
            setEditing(undefined)
          }}
        />
      )}
    </div>
  )
}

function RecurringForm({
  template, categories, onClose, onSaved,
}: {
  template: RecurringExpense | null
  categories: ExpenseCategory[]
  onClose: () => void
  onSaved: (t: RecurringExpense) => void
}) {
  const [vendor, setVendor]               = useState(template?.vendor || '')
  const [categoryId, setCategoryId]       = useState(template?.category_id || '')
  const [amount, setAmount]               = useState(template?.expected_amount != null ? String(template.expected_amount) : '')
  const [day, setDay]                     = useState(template?.expected_day_of_month != null ? String(template.expected_day_of_month) : '')
  const [cadence, setCadence]             = useState<ExpenseCadence>(template?.cadence || 'monthly')
  const [isActive, setIsActive]           = useState(template?.is_active ?? true)
  const [saving, setSaving]               = useState(false)

  const handleSave = async () => {
    if (!vendor.trim()) return
    setSaving(true)
    const payload = {
      vendor: vendor.trim(),
      category_id: categoryId || null,
      expected_amount: amount ? Number(amount) : null,
      expected_day_of_month: day ? Math.min(31, Math.max(1, Number(day))) : null,
      cadence,
      is_active: isActive,
    }
    const url    = template ? `/api/recurring-expenses/${template.id}` : '/api/recurring-expenses'
    const method = template ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (res.ok) onSaved(await res.json())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="surface w-full max-w-md p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold">{template ? 'עריכת תבנית' : 'תבנית חדשה'}</h3>

        <div>
          <div className="label mb-1.5">שם ספק *</div>
          <input className="input w-full" value={vendor} onChange={e => setVendor(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1.5">קטגוריה</div>
            <select className="input w-full text-sm" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name_he}</option>)}
            </select>
          </div>
          <div>
            <div className="label mb-1.5">מחזוריות</div>
            <select className="input w-full text-sm" value={cadence} onChange={e => setCadence(e.target.value as ExpenseCadence)}>
              <option value="monthly">חודשי</option>
              <option value="quarterly">רבעוני</option>
              <option value="yearly">שנתי</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1.5">סכום צפוי (₪)</div>
            <input className="input w-full text-sm ltr" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} dir="ltr" />
          </div>
          <div>
            <div className="label mb-1.5">יום בחודש (1-31)</div>
            <input className="input w-full text-sm ltr" type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} dir="ltr" />
          </div>
        </div>

        <button
          onClick={() => setIsActive(v => !v)}
          className={cn('flex items-center gap-2 text-sm self-start', isActive ? 'text-emerald-600' : 'text-muted')}
        >
          <span className={cn('inline-block w-3 h-3 rounded-full', isActive ? 'bg-emerald-500' : 'bg-cream-dark dark:bg-navy-light')} />
          {isActive ? 'פעיל' : 'כבוי'}
        </button>

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving || !vendor.trim()} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {template ? 'שמור' : 'צור'}
          </button>
          <button onClick={onClose} className="btn-secondary">ביטול</button>
        </div>
      </div>
    </div>
  )
}
