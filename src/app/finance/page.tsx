'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { MonthlyPurchasesSection } from '@/components/finance/MonthlyPurchasesSection'

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
  totals: {
    revenue_gross: number; revenue_net: number
    cogs_gross: number;    cogs_net: number
    expenses_gross: number; expenses_net: number
    profit_gross: number;  profit_net: number
    margin_pct: number
    orders_count: number
  }
}

function monthLabel(key: string): string {
  return new Date(key + '-15').toLocaleString('he-IL', { month: 'short', year: '2-digit' })
}

function monthLabelLong(key: string): string {
  return new Date(key + '-15').toLocaleString('he-IL', { month: 'long', year: 'numeric' })
}

export default function FinancePage() {
  const [data, setData]       = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths]   = useState(12)
  const [vatMode, setVatMode] = useState<'net' | 'gross'>('net')
  const [refresh, setRefresh] = useState(0)   // bump to refetch summary after edits
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/finance/summary?months=${months}`)
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
  }, [months, refresh])

  const pick = (gross: number, net: number) => vatMode === 'net' ? net : gross
  const suffix = vatMode === 'net' ? 'ללא מע״מ' : 'כולל מע״מ'

  const currentMonth = data?.rows[data.rows.length - 1]
  const prevMonth    = data && data.rows.length >= 2 ? data.rows[data.rows.length - 2] : null

  const trendChange = (current: number, prev: number) => {
    if (!prev || prev === 0) return null
    return Math.round(((current - prev) / prev) * 100)
  }

  // Chart bounds
  const chartMax = useMemo(() => {
    if (!data) return 1
    const values = data.rows.flatMap(r => [
      Math.abs(pick(r.revenue_gross, r.revenue_net)),
      Math.abs(pick(r.expenses_gross, r.expenses_net) + pick(r.cogs_gross, r.cogs_net)),
    ])
    return Math.max(...values, 1)
  }, [data, vatMode])

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="page-header"><h1>הכנסות מול הוצאות</h1></div>
        <div className="text-center py-20 text-muted text-sm">טוען...</div>
      </div>
    )
  }

  if (error || !data) {
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

  const cur = currentMonth!
  const revChange   = prevMonth && trendChange(pick(cur.revenue_gross,  cur.revenue_net),  pick(prevMonth.revenue_gross,  prevMonth.revenue_net))
  const expChange   = prevMonth && trendChange(pick(cur.expenses_gross, cur.expenses_net), pick(prevMonth.expenses_gross, prevMonth.expenses_net))
  const profChange  = prevMonth && trendChange(pick(cur.profit_gross,   cur.profit_net),   pick(prevMonth.profit_gross,   prevMonth.profit_net))

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1>הכנסות מול הוצאות</h1>
          <p className="text-xs text-muted mt-0.5">{monthLabelLong(cur.month)} · {suffix}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Months window */}
          <div className="relative">
            <select
              value={months}
              onChange={e => setMonths(Number(e.target.value))}
              className="input text-sm cursor-pointer appearance-none pr-3 pl-8 py-1.5"
            >
              <option value={3}>3 חודשים</option>
              <option value={6}>6 חודשים</option>
              <option value={12}>12 חודשים</option>
              <option value={24}>24 חודשים</option>
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          </div>

          {/* VAT toggle */}
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
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label={`הכנסות ${monthLabel(cur.month)}`}
          value={pick(cur.revenue_gross, cur.revenue_net)}
          change={revChange}
          tone="emerald"
          sub={`${cur.orders_count} הזמנות`}
        />
        <KPI
          label="הוצאות"
          value={pick(cur.expenses_gross, cur.expenses_net)}
          change={expChange}
          tone="red"
          invert
          sub={`${cur.categories.length} קטגוריות`}
        />
        <KPI
          label="עלות ייצור"
          value={pick(cur.cogs_gross, cur.cogs_net)}
          tone="amber"
          sub="חומרי גלם להזמנות החודש"
        />
        <KPI
          label="רווח נקי"
          value={pick(cur.profit_gross, cur.profit_net)}
          change={profChange}
          tone={pick(cur.profit_gross, cur.profit_net) >= 0 ? 'gold' : 'red'}
          sub={`שולי רווח ${cur.margin_pct}%`}
        />
      </div>

      {/* Trend chart */}
      <div className="surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label">מגמה לאורך {months} חודשים</div>
          <div className="flex gap-3 text-[11px]">
            <Legend dot="bg-emerald-500" label="הכנסות" />
            <Legend dot="bg-amber-500" label="עלות+הוצאות" />
            <Legend dot="bg-gold" label="רווח" />
          </div>
        </div>
        <div className="flex items-end gap-1 h-36">
          {data.rows.map(r => {
            const rev  = pick(r.revenue_gross, r.revenue_net)
            const cost = pick(r.expenses_gross, r.expenses_net) + pick(r.cogs_gross, r.cogs_net)
            const prof = pick(r.profit_gross, r.profit_net)
            const revH = Math.max((rev  / chartMax) * 100, 1)
            const cosH = Math.max((cost / chartMax) * 100, 1)
            return (
              <div key={r.month} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  {prof >= 0 ? '+' : ''}{formatPrice(prof)}
                </div>
                <div className="w-full flex items-end gap-0.5 h-24">
                  <div className="flex-1 bg-emerald-400/80 rounded-t" style={{ height: `${revH}%` }} title={`הכנסות ${formatPrice(rev)}`} />
                  <div className="flex-1 bg-amber-400/80 rounded-t" style={{ height: `${cosH}%` }} title={`עלות ${formatPrice(cost)}`} />
                </div>
                <span className="text-[10px] text-muted">{monthLabel(r.month)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Manually-tracked monthly purchases — fold into the same expense totals on the API side */}
      <MonthlyPurchasesSection
        month={cur.month}
        vatMode={vatMode}
        onTotalChange={() => setRefresh(r => r + 1)}
      />

      {/* Category breakdown this month */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface p-5">
          <div className="label mb-3">פירוט הוצאות — {monthLabel(cur.month)}</div>
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

        <div className="surface p-5">
          <div className="label mb-3">סיכום תקופה ({months} חודשים)</div>
          <div className="flex flex-col gap-2.5 text-sm">
            <Row label="סה״כ הכנסות" value={formatPrice(pick(data.totals.revenue_gross, data.totals.revenue_net))} tone="emerald" />
            <Row label="סה״כ עלות ייצור" value={`−${formatPrice(pick(data.totals.cogs_gross, data.totals.cogs_net))}`} />
            <Row label="סה״כ הוצאות" value={`−${formatPrice(pick(data.totals.expenses_gross, data.totals.expenses_net))}`} />
            <div className="border-t border-cream-dark dark:border-navy-light my-1" />
            <Row
              label="רווח נקי"
              value={formatPrice(pick(data.totals.profit_gross, data.totals.profit_net))}
              tone={pick(data.totals.profit_gross, data.totals.profit_net) >= 0 ? 'gold' : 'red'}
              bold
            />
            <Row label="שולי רווח ממוצע" value={`${data.totals.margin_pct}%`} />
            <Row label="הזמנות בתקופה" value={String(data.totals.orders_count)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function KPI({
  label, value, change, tone, sub, invert,
}: {
  label:   string
  value:   number
  change?: number | null
  tone:    'emerald' | 'red' | 'amber' | 'gold'
  sub?:    string
  invert?: boolean   // for expenses: ↑ is bad (red), ↓ is good (green)
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
      <div className="flex items-center gap-2 mt-0.5">
        {change != null && <Trend pct={change} invert={invert} />}
        {sub && <span className="text-[10px] text-muted">{sub}</span>}
      </div>
    </div>
  )
}

function Trend({ pct, invert }: { pct: number; invert?: boolean }) {
  const isGood = invert ? pct < 0 : pct > 0
  if (pct === 0) return <span className="flex items-center gap-0.5 text-[10px] text-muted"><Minus size={10} />0%</span>
  return pct > 0
    ? <span className={cn('flex items-center gap-0.5 text-[10px]', isGood ? 'text-emerald-600' : 'text-red-500')}><TrendingUp size={10} />+{pct}%</span>
    : <span className={cn('flex items-center gap-0.5 text-[10px]', isGood ? 'text-emerald-600' : 'text-red-500')}><TrendingDown size={10} />{pct}%</span>
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted">
      <span className={cn('w-2 h-2 rounded-full', dot)} />
      {label}
    </span>
  )
}

function Row({ label, value, tone, bold }: { label: string; value: string; tone?: 'emerald' | 'red' | 'gold'; bold?: boolean }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600'
    : tone === 'red' ? 'text-red-500'
    : tone === 'gold' ? 'text-gold'
    : ''
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-muted', bold && 'font-medium text-navy dark:text-cream')}>{label}</span>
      <span className={cn('ltr tabular-nums', toneClass, bold && 'text-base font-semibold')}>{value}</span>
    </div>
  )
}
