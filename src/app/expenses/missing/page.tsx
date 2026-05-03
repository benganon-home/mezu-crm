'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, Plus, Repeat, ChevronDown } from 'lucide-react'
import { ExpenseCategory } from '@/types'
import { formatPrice, cn } from '@/lib/utils'
import { ExpenseDrawer } from '@/components/expenses/ExpenseDrawer'

interface Gap {
  vendor: string
  category_id: string | null
  category_name: string | null
  category_color: string | null
  missing_month: string
  typical_amount: number | null
  typical_day_of_month: number | null
  months_seen: number
  total_months_in_range: number
  confidence: 'high' | 'medium' | 'low'
  is_current_month: boolean
}

const CONF_LABEL = {
  high:   'בטוח חסר',
  medium: 'כנראה חסר',
  low:    'אולי חסר',
}
const CONF_STYLES = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low:    'bg-cream dark:bg-navy-deeper text-muted',
}

function monthLabel(key: string): string {
  return new Date(key + '-15').toLocaleString('he-IL', { month: 'long', year: 'numeric' })
}

export default function MissingExpensesPage() {
  const [gaps, setGaps]             = useState<Gap[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [creating, setCreating]     = useState<Gap | null>(null)

  const load = async () => {
    setLoading(true)
    const [gRes, cRes] = await Promise.all([
      fetch('/api/expenses/gaps'),
      fetch('/api/expense-categories'),
    ])
    const gJson = await gRes.json()
    setGaps(gJson.gaps || [])
    setCategories(await cRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = gaps.filter(g => filter === 'all' || g.confidence === filter)

  // Group by missing_month for visual organization
  const groups = new Map<string, Gap[]>()
  for (const g of filtered) {
    const key = g.is_current_month ? '_current_' : g.missing_month
    const arr = groups.get(key) || []
    arr.push(g)
    groups.set(key, arr)
  }
  const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === '_current_') return -1
    if (b === '_current_') return 1
    return b.localeCompare(a)
  })

  const counts = {
    all:    gaps.length,
    high:   gaps.filter(g => g.confidence === 'high').length,
    medium: gaps.filter(g => g.confidence === 'medium').length,
    low:    gaps.filter(g => g.confidence === 'low').length,
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Link href="/expenses" className="text-muted hover:text-navy dark:hover:text-cream"><ArrowRight size={16} /></Link>
          <div>
            <h1>הוצאות חסרות</h1>
            <p className="text-xs text-muted mt-0.5">{counts.all} פוטנציאליות · {counts.high} בטוח · {counts.medium} כנראה</p>
          </div>
        </div>
        <Link href="/expenses/recurring" className="btn-secondary flex items-center gap-2 text-sm">
          <Repeat size={14} strokeWidth={1.5} /> תבניות
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 items-center overflow-x-auto pb-0.5">
        {(['all', 'high', 'medium', 'low'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('chip-btn whitespace-nowrap', filter === f && 'chip-btn-active')}
          >
            {f === 'all' ? 'הכל' : CONF_LABEL[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-muted">טוען...</div>}

      {!loading && counts.all === 0 && (
        <div className="surface text-center py-12 text-emerald-700 dark:text-emerald-300 text-sm">
          ✓ לא זוהו הוצאות חסרות. כל הספקים החודשיים נרשמו במועדם.
        </div>
      )}

      {!loading && filtered.length === 0 && counts.all > 0 && (
        <div className="surface text-center py-8 text-muted text-sm">
          אין תוצאות בסינון הנוכחי
        </div>
      )}

      {/* Grouped list by month */}
      <div className="flex flex-col gap-5">
        {orderedKeys.map(monthKey => {
          const items = groups.get(monthKey)!
          const isCur = monthKey === '_current_'
          const label = isCur ? 'החודש' : monthLabel(items[0].missing_month)
          return (
            <section key={monthKey}>
              <div className={cn('label mb-2 flex items-center gap-2', isCur && 'text-red-500')}>
                {isCur && <AlertTriangle size={12} />}
                {label} <span className="text-muted/60">— {items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map(g => (
                  <GapCard key={`${g.vendor}-${g.missing_month}`} gap={g} onCreate={() => setCreating(g)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {creating && (
        <ExpenseDrawer
          expense={null}
          categories={categories}
          initialValues={{
            vendor:       creating.vendor,
            amount:       creating.typical_amount ?? undefined,
            category_id:  creating.category_id ?? undefined,
            notes:        `ייתכן שזו ההוצאה החסרה ל-${creating.is_current_month ? 'החודש' : monthLabel(creating.missing_month)}`,
          }}
          onClose={() => setCreating(null)}
          onSaved={() => { setCreating(null); load() }}
        />
      )}
    </div>
  )
}

function GapCard({ gap: g, onCreate }: { gap: Gap; onCreate: () => void }) {
  return (
    <div className={cn(
      'surface px-3 py-3 flex items-start gap-3 border-l-2',
      g.confidence === 'high'   && 'border-l-red-400',
      g.confidence === 'medium' && 'border-l-amber-400',
      g.confidence === 'low'    && 'border-l-cream-dark dark:border-l-navy-light',
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{g.vendor}</span>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full', CONF_STYLES[g.confidence])}>
            {CONF_LABEL[g.confidence]}
          </span>
          {g.category_name && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: (g.category_color || '#9490B8') + '22', color: g.category_color || '#9490B8' }}>
              {g.category_name}
            </span>
          )}
        </div>
        <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {g.typical_amount != null && <span className="ltr">~{formatPrice(g.typical_amount)} בממוצע</span>}
          {g.typical_day_of_month && <span>נרשם בדרך כלל ביום {g.typical_day_of_month}</span>}
          <span>נראה ב-{g.months_seen} מתוך {g.total_months_in_range} חודשים</span>
        </div>
      </div>
      <button
        onClick={onCreate}
        className="btn-primary text-xs flex items-center gap-1.5 shrink-0"
      >
        <Plus size={12} /> רשום
      </button>
    </div>
  )
}
