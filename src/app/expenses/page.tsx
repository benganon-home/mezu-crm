'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Upload, ChevronDown, FileText, ExternalLink, MessageCircle, AlertTriangle, Repeat } from 'lucide-react'
import { Expense, ExpenseCategory, ExpenseStatus, EXPENSE_STATUS_LABELS, RecurringExpense } from '@/types'
import { formatPrice, formatDate, buildWaLink, cn } from '@/lib/utils'
import { ExpenseDrawer } from '@/components/expenses/ExpenseDrawer'
import { ImportXlsxModal } from '@/components/expenses/ImportXlsxModal'

const STATUSES: Array<ExpenseStatus | 'all'> = ['all', 'active', 'archived', 'duplicate_suspect']

function thisMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  if (!key) return ''
  return new Date(key + '-15').toLocaleString('he-IL', { month: 'long', year: 'numeric' })
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ExpensesPage() {
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [count, setCount]             = useState(0)
  const [categories, setCategories]   = useState<ExpenseCategory[]>([])
  const [missing, setMissing]         = useState<RecurringExpense[]>([])
  const [accountantPhone, setAccountantPhone] = useState<string>('')

  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [month, setMonth]             = useState(thisMonthKey())
  const [allMonths, setAllMonths]     = useState(false)

  const [editing, setEditing]         = useState<Expense | null | undefined>(undefined)  // undefined = closed, null = new, Expense = edit
  const [showImport, setShowImport]   = useState(false)

  // ─── Fetchers ────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/expense-categories')
    setCategories(await res.json())
  }, [])

  const fetchMissing = useCallback(async () => {
    const res = await fetch('/api/expenses/missing')
    if (res.ok) {
      const json = await res.json()
      setMissing(json.data || [])
    }
  }, [])

  const fetchAccountant = useCallback(async () => {
    const res = await fetch('/api/app-settings?key=accountant')
    if (res.ok) {
      const { value } = await res.json()
      setAccountantPhone(value?.phone || '')
    }
  }, [])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '500' })
    if (search) params.set('search', search)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (categoryFilter) params.set('category_id', categoryFilter)
    if (!allMonths) params.set('month', month)
    const res = await fetch(`/api/expenses?${params}`)
    const json = await res.json()
    setExpenses(json.data || [])
    setCount(json.count || 0)
    setLoading(false)
  }, [search, statusFilter, categoryFilter, month, allMonths])

  useEffect(() => { fetchCategories(); fetchMissing(); fetchAccountant() }, [fetchCategories, fetchMissing, fetchAccountant])
  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // ─── Computed totals ─────────────────────────────────────
  const stats = useMemo(() => {
    const active = expenses.filter(e => e.status === 'active')
    const total  = active.reduce((s, e) => s + Number(e.amount || 0), 0)
    const byCategory = new Map<string, { name: string; color: string; total: number; count: number }>()
    for (const e of active) {
      const cat = e.category
      const key = cat?.id || 'none'
      const cur = byCategory.get(key) || { name: cat?.name_he || 'ללא קטגוריה', color: cat?.color || '#9490B8', total: 0, count: 0 }
      cur.total += Number(e.amount || 0)
      cur.count += 1
      byCategory.set(key, cur)
    }
    const topCategories = Array.from(byCategory.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
    return { total, count: active.length, archivedCount: expenses.filter(e => e.status !== 'active').length, topCategories }
  }, [expenses])

  // ─── WhatsApp share to accountant ────────────────────────
  const sendToAccountant = async (e: Expense) => {
    if (!accountantPhone) {
      alert('הוסף טלפון רו״ח בהגדרות תחילה')
      return
    }
    const lines = [
      `חשבונית חדשה`,
      `ספק: ${e.vendor}`,
      e.amount ? `סכום: ₪${e.amount}` : null,
      e.invoice_number ? `מס׳: ${e.invoice_number}` : null,
      e.document_date ? `תאריך: ${formatDate(e.document_date)}` : null,
      e.invoice_url ? `\n${e.invoice_url}` : null,
    ].filter(Boolean).join('\n')

    window.open(buildWaLink(accountantPhone, lines), '_blank')

    // Mark sent timestamp (best-effort)
    fetch(`/api/expenses/${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent_to_accountant_at: new Date().toISOString() }),
    }).catch(() => {})
  }

  const handleSaved = (saved: Expense) => {
    setExpenses(prev => {
      const exists = prev.some(x => x.id === saved.id)
      return exists ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]
    })
    setEditing(undefined)
    fetchMissing()
  }

  const handleDeleted = (id: string) => {
    setExpenses(prev => prev.filter(x => x.id !== id))
    setEditing(undefined)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1>הוצאות</h1>
            <p className="text-xs text-muted mt-0.5">{count} רשומות{count > expenses.length ? ` · מציג ${expenses.length}` : ''}</p>
          </div>
          {/* Month switcher */}
          <div className="flex items-center gap-1 surface px-1 py-1 rounded-full">
            <button
              onClick={() => { setMonth(shiftMonth(month, -1)); setAllMonths(false) }}
              className="px-2 py-1 text-sm hover:bg-cream dark:hover:bg-navy-light rounded-full"
            >‹</button>
            <button
              onClick={() => setAllMonths(v => !v)}
              className={cn('px-3 py-1 text-xs font-medium rounded-full', allMonths ? 'bg-navy text-cream dark:bg-gold dark:text-navy' : '')}
              title={allMonths ? 'מציג הכל' : 'לחץ להציג הכל'}
            >
              {allMonths ? 'כל החודשים' : monthLabel(month)}
            </button>
            <button
              onClick={() => { setMonth(shiftMonth(month, +1)); setAllMonths(false) }}
              className="px-2 py-1 text-sm hover:bg-cream dark:hover:bg-navy-light rounded-full"
            >›</button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/expenses/recurring" className="btn-secondary flex items-center gap-2 text-sm">
            <Repeat size={14} strokeWidth={1.5} /> מחזוריות
          </Link>
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} strokeWidth={1.5} /> ייבוא
          </button>
          <button onClick={() => setEditing(null)} className="btn-primary flex items-center gap-2">
            <Plus size={14} strokeWidth={1.5} /> חשבונית חדשה
          </button>
        </div>
      </div>

      {/* Missing alert banner */}
      {missing.length > 0 && (
        <Link href="/expenses/missing" className="surface px-4 py-3 flex items-center gap-3 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 transition-colors">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-amber-900 dark:text-amber-200">{missing.length} הוצאות חסרות החודש</span>
            <span className="text-amber-700/80 dark:text-amber-300/80"> — {missing.slice(0, 3).map(m => m.vendor).join(', ')}{missing.length > 3 ? '...' : ''}</span>
          </div>
          <ExternalLink size={14} className="text-amber-600" />
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface px-4 py-3 flex flex-col gap-1">
          <div className="text-xs text-muted font-medium">סה״כ הוצאות</div>
          <div className="text-2xl font-semibold text-gold ltr leading-none">{formatPrice(stats.total)}</div>
          <div className="text-[10px] text-muted mt-0.5">{stats.count} רשומות פעילות</div>
        </div>
        {stats.topCategories.map(c => (
          <div key={c.name} className="surface px-4 py-3 flex flex-col gap-1">
            <div className="text-xs text-muted font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </div>
            <div className="text-xl font-semibold ltr leading-none">{formatPrice(c.total)}</div>
            <div className="text-[10px] text-muted mt-0.5">{c.count} רשומות</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:flex-1">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pr-9 w-full"
            placeholder="חיפוש לפי ספק / מס׳ חשבונית / מס׳ סידורי..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 items-center overflow-x-auto pb-0.5 md:shrink-0 md:overflow-visible md:pb-0">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn('chip-btn whitespace-nowrap', statusFilter === s && 'chip-btn-active')}
            >
              {s === 'all' ? 'הכל' : EXPENSE_STATUS_LABELS[s as ExpenseStatus]}
            </button>
          ))}
        </div>
        <div className="relative md:w-[180px] md:shrink-0">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="input text-sm cursor-pointer w-full appearance-none pr-3 pl-8"
          >
            <option value="">כל הקטגוריות</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name_he}</option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
      </div>

      {/* List — desktop table + mobile cards */}
      <ExpensesList
        expenses={expenses}
        loading={loading}
        accountantPhone={accountantPhone}
        onEdit={(e) => setEditing(e)}
        onSendToAccountant={sendToAccountant}
      />

      {editing !== undefined && (
        <ExpenseDrawer
          expense={editing}
          categories={categories}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {showImport && (
        <ImportXlsxModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchExpenses(); fetchMissing() }}
        />
      )}
    </div>
  )
}

// ─── Sub-component: list ─────────────────────────────────────
interface ListProps {
  expenses: Expense[]
  loading: boolean
  accountantPhone: string
  onEdit: (e: Expense) => void
  onSendToAccountant: (e: Expense) => void
}

function ExpensesList({ expenses, loading, accountantPhone, onEdit, onSendToAccountant }: ListProps) {
  if (loading) return <div className="text-center py-12 text-muted text-sm">טוען...</div>
  if (!expenses.length) return <div className="surface text-center py-12 text-muted text-sm">לא נמצאו רשומות</div>

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-2">
        {expenses.map(e => (
          <ExpenseCardMobile
            key={e.id}
            expense={e}
            accountantPhone={accountantPhone}
            onEdit={onEdit}
            onSendToAccountant={onSendToAccountant}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block surface overflow-hidden">
        <table className="crm-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>ספק</th>
              <th>קטגוריה</th>
              <th>מס׳ חשבונית</th>
              <th className="text-left">סכום</th>
              <th>סטטוס</th>
              <th className="w-[120px] text-left">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} onClick={() => onEdit(e)} className="cursor-pointer">
                <td className="ltr text-xs text-muted whitespace-nowrap">
                  {e.document_date ? formatDate(e.document_date) : '—'}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{e.vendor}</span>
                    {e.invoice_url && (
                      <a href={e.invoice_url} target="_blank" rel="noreferrer" className="text-gold hover:opacity-70" onClick={ev => ev.stopPropagation()} title="פתח חשבונית">
                        <FileText size={13} />
                      </a>
                    )}
                  </div>
                  {e.notes && <div className="text-[11px] text-muted truncate max-w-[280px] mt-0.5">{e.notes}</div>}
                </td>
                <td>
                  {e.category ? (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: e.category.color + '22', color: e.category.color }}>
                      {e.category.name_he}
                    </span>
                  ) : <span className="text-muted/40 text-xs">—</span>}
                </td>
                <td className="ltr text-xs text-muted">{e.invoice_number || '—'}</td>
                <td className="text-left ltr font-medium text-sm tabular-nums">
                  {e.amount != null ? formatPrice(Number(e.amount)) : '—'}
                </td>
                <td>
                  <StatusPill status={e.status} />
                </td>
                <td className="text-left" onClick={ev => ev.stopPropagation()}>
                  {accountantPhone && (
                    <button
                      onClick={() => onSendToAccountant(e)}
                      className="text-muted hover:text-[#25D366] p-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      title="שלח לרו״ח בוואטסאפ"
                    >
                      <MessageCircle size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ExpenseCardMobile({
  expense: e, accountantPhone, onEdit, onSendToAccountant,
}: {
  expense: Expense
  accountantPhone: string
  onEdit: (e: Expense) => void
  onSendToAccountant: (e: Expense) => void
}) {
  return (
    <div className="surface px-3 py-3 flex flex-col gap-2 active:bg-gold/5" onClick={() => onEdit(e)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{e.vendor}</div>
          <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
            <span className="ltr">{e.document_date ? formatDate(e.document_date) : '—'}</span>
            {e.invoice_number && <span className="ltr">· {e.invoice_number}</span>}
          </div>
        </div>
        <div className="ltr text-base font-semibold text-gold tabular-nums shrink-0">
          {e.amount != null ? formatPrice(Number(e.amount)) : '—'}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {e.category && (
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: e.category.color + '22', color: e.category.color }}>
            {e.category.name_he}
          </span>
        )}
        <StatusPill status={e.status} />
        <div className="flex-1" />
        {e.invoice_url && (
          <a href={e.invoice_url} target="_blank" rel="noreferrer" className="text-gold p-1" onClick={ev => ev.stopPropagation()}>
            <FileText size={14} />
          </a>
        )}
        {accountantPhone && (
          <button
            onClick={ev => { ev.stopPropagation(); onSendToAccountant(e) }}
            className="text-[#25D366] p-1"
            aria-label="שלח לרו״ח"
          >
            <MessageCircle size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: ExpenseStatus }) {
  const styles: Record<ExpenseStatus, string> = {
    active:            'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    archived:          'bg-cream dark:bg-navy-light text-muted',
    duplicate_suspect: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  }
  return (
    <span className={cn('text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap', styles[status])}>
      {EXPENSE_STATUS_LABELS[status]}
    </span>
  )
}
