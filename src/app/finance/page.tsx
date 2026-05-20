'use client'

import { useState, useEffect } from 'react'
import { cn, formatPrice } from '@/lib/utils'
import { MonthlyPurchasesSection } from '@/components/finance/MonthlyPurchasesSection'

// Single-month P&L hub. We deliberately load just the current month —
// the previous 12-month view was the heaviest read in the CRM and the
// numbers most useful to the user are current-month anyway. Need history?
// /analytics + /expenses both keep multi-month views.

interface CatBreakdown {
  id:    string | null
  name:  string
  color: string
  total: number
}

interface MonthRow {
  month:          string
  revenue_gross:  number
  revenue_net:    number
  cogs_gross:     number
  cogs_net:       number
  expenses_gross: number
  expenses_net:   number
  profit_gross:   number
  profit_net:     number
  margin_pct:     number
  orders_count:   number
  categories:     CatBreakdown[]
}

interface Summary {
  from:   string
  to:     string
  months: number
  rows:   MonthRow[]
}

function monthLabelLong(key: string): string {
  return new Date(key + '-15').toLocaleString('he-IL', { month: 'long', year: 'numeric' })
}

export default function FinancePage() {
  const [data, setData]       = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [vatMode, setVatMode] = useState<'net' | 'gross'>('net')
  const [refresh, setRefresh] = useState(0)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    // ?months=1 → the API only scans current-month data
    fetch(`/api/finance/summary?months=1`)
      .then(async r => {
        if (!r.ok) {
          const txt = await r.text().catch(() => '')
          throw new Error(`שגיאת שרת (${r.status})${txt ? ': ' + txt.slice(0, 120) : ''}`)
        }
        return r.json()
      })
      .then(json => {
        if (json?.error) throw new Error(json.error)
        setData(json)
      })
      .catch(e => setError(e?.message || 'שגיאה בטעינת נתונים'))
      .finally(() => setLoading(false))
  }, [refresh])

  const pick = (gross: number, net: number) => vatMode === 'net' ? net : gross
  const suffix = vatMode === 'net' ? 'ללא מע״מ' : 'כולל מע״מ'

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="page-header"><h1>הכנסות מול הוצאות</h1></div>
        <div className="text-center py-20 text-muted text-sm">טוען...</div>
      </div>
    )
  }

  if (error || !data || !data.rows.length) {
    return (
      <div className="flex flex-col gap-5">
        <div className="page-header"><h1>הכנסות מול הוצאות</h1></div>
        <div className="surface px-4 py-6 text-center text-sm text-red-600 dark:text-red-300">
          {error || 'אין נתונים להציג'}
          <div className="mt-3">
            <button onClick={() => setRefresh(r => r + 1)} className="btn-secondary text-xs">
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cur = data.rows[0]
  const profit = pick(cur.profit_gross, cur.profit_net)
  const margin = cur.margin_pct

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1>הכנסות מול הוצאות</h1>
          <p className="text-xs text-muted mt-0.5">{monthLabelLong(cur.month)} · {suffix}</p>
        </div>
        <div className="flex items-center surface px-1 py-1 rounded-full">
          {(['net', 'gross'] as const).map(m => (
            <button
              key={m}
              onClick={() => setVatMode(m)}
              className={cn('px-3 py-1 text-xs rounded-full transition', vatMode === m ? 'bg-navy text-cream dark:bg-gold dark:text-navy' : 'text-muted')}
            >
              {m === 'net' ? 'ללא מע״מ' : 'כולל מע״מ'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="הכנסות" value={pick(cur.revenue_gross, cur.revenue_net)} tone="emerald" sub={`${cur.orders_count} הזמנות`} />
        <KPI label="הוצאות" value={pick(cur.expenses_gross, cur.expenses_net)} tone="red" sub={`${cur.categories.length} קטגוריות`} />
        <KPI label="עלות ייצור" value={pick(cur.cogs_gross, cur.cogs_net)} tone="amber" sub="חומרי גלם" />
        <KPI label="רווח נקי" value={profit} tone={profit >= 0 ? 'gold' : 'red'} sub={`שולי רווח ${margin}%`} />
      </div>

      {/* Manually-tracked monthly purchases */}
      <MonthlyPurchasesSection
        month={cur.month}
        vatMode={vatMode}
        onTotalChange={() => setRefresh(r => r + 1)}
      />

      {/* Expense category breakdown for THIS month */}
      <div className="surface p-5">
        <div className="label mb-3">פירוט הוצאות לפי קטגוריה</div>
        {cur.categories.length === 0 ? (
          <div className="text-xs text-muted">אין הוצאות פעילות החודש</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cur.categories.map(c => {
              const value = vatMode === 'net' ? c.total / 1.18 : c.total
              const max = vatMode === 'net' ? cur.expenses_net : cur.expenses_gross
              const pct = max > 0 ? Math.round((value / max) * 100) : 0
              return (
                <div key={c.id ?? c.name} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-sm flex-1 truncate">{c.name}</span>
                  <div className="w-24 bg-cream dark:bg-navy-deeper rounded-full h-1.5 overflow-hidden shrink-0">
                    <div className="h-full rounded-full" style={{ backgroundColor: c.color, width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums ltr w-16 text-left">{formatPrice(Math.round(value * 100) / 100)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({
  label, value, tone, sub,
}: {
  label: string
  value: number
  tone:  'emerald' | 'red' | 'amber' | 'gold'
  sub?:  string
}) {
  const toneClass = {
    emerald: 'text-emerald-600',
    red:     'text-red-500',
    amber:   'text-amber-600',
    gold:    'text-gold',
  }[tone]

  return (
    <div className="surface px-4 py-3 flex flex-col gap-1">
      <div className="text-xs text-muted font-medium truncate">{label}</div>
      <div className={cn('text-2xl font-semibold ltr leading-none', toneClass)}>{formatPrice(value)}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  )
}
