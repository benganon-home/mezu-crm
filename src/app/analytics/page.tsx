'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { ITEM_COLOR_MAP } from '@/types'

interface AnalyticsData {
  db: {
    totalOrders:        number
    totalRevenue:       number
    avgOrderValue:      number
    repeatCustomersPct: number
    byMonth:            Array<{ month: string; count: number; revenue: number }>
    topColors:          Array<{ name: string; count: number }>
    topFonts:           Array<{ name: string; count: number }>
    topSignTypes:       Array<{ name: string; count: number }>
    deliveryBreakdown:  { delivery: number; pickup: number }
    byDayOfWeek:        Array<{ day: string; count: number }>
  }
  morning: {
    monthly:      Array<{ month: string; total: number }>
    currentMonth: number | null
    lastMonth:    number | null
  }
}

function heMonth(key: string) {
  return new Date(key + '-02').toLocaleString('he-IL', { month: 'short' })
}

function Trend({ current, prev }: { current: number | null; prev: number | null }) {
  if (current == null || prev == null || prev === 0) return null
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return <span className="flex items-center gap-0.5 text-xs text-muted"><Minus size={11} />{pct}%</span>
  return pct > 0
    ? <span className="flex items-center gap-0.5 text-xs text-emerald-600"><TrendingUp size={11} />+{pct}%</span>
    : <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown size={11} />{pct}%</span>
}

function BarChart({ data, valueKey, labelKey, color = 'bg-gold' }: {
  data: Array<Record<string, any>>
  valueKey: string
  labelKey: string
  color?: string
}) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => {
        const pct = Math.round((d[valueKey] / max) * 100)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted tabular-nums leading-none">
              {d[valueKey] > 0 ? (valueKey === 'revenue' ? `₪${Math.round(d[valueKey]/1000)}k` : d[valueKey]) : ''}
            </span>
            <div className="w-full flex items-end" style={{ height: 72 }}>
              <div
                className={cn('w-full rounded-t-md transition-all duration-500', color)}
                style={{ height: `${Math.max(pct, 3)}%`, opacity: 0.85 + (i / data.length) * 0.15 }}
              />
            </div>
            <span className="text-[10px] text-muted leading-none">{d[labelKey]}</span>
          </div>
        )
      })}
    </div>
  )
}

function RankRow({ name, count, max, color }: { name: string; count: number; max: number; color?: string }) {
  const pct = max ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      {color && (
        <div
          className="w-3 h-3 rounded-full shrink-0 border border-black/10"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-sm min-w-0 truncate flex-1">{name}</span>
      <div className="w-24 bg-cream dark:bg-navy-deeper rounded-full h-1.5 overflow-hidden shrink-0">
        <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-muted tabular-nums w-6 text-left ltr">{count}</span>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const year = new Date().getFullYear()

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="page-header"><h1>אנליטיקס</h1></div>
        <div className="text-center py-20 text-muted text-sm">טוען נתונים...</div>
      </div>
    )
  }

  if (!data) return null

  const { db, morning } = data

  const revenueChange = morning.currentMonth != null && morning.lastMonth != null && morning.lastMonth > 0
    ? Math.round(((morning.currentMonth - morning.lastMonth) / morning.lastMonth) * 100)
    : null

  const maxDayCount = Math.max(...db.byDayOfWeek.map(d => d.count), 1)
  const maxColor    = Math.max(...db.topColors.map(c => c.count), 1)
  const maxFont     = Math.max(...db.topFonts.map(f => f.count), 1)
  const maxSign     = Math.max(...db.topSignTypes.map(s => s.count), 1)

  const morningChartData = morning.monthly.map(m => ({
    month: heMonth(m.month),
    revenue: m.total,
  }))

  const dbChartData = db.byMonth.map(m => ({
    month: heMonth(m.month),
    count: m.count,
  }))

  const totalDelivery = db.deliveryBreakdown.delivery + db.deliveryBreakdown.pickup
  const deliveryPct   = totalDelivery ? Math.round((db.deliveryBreakdown.delivery / totalDelivery) * 100) : 0
  const pickupPct     = 100 - deliveryPct

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1>אנליטיקס</h1>
          <p className="text-xs text-muted mt-0.5">נתוני {year}</p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <div className="surface px-4 py-3 flex flex-col gap-1">
          <div className="text-xs text-muted font-medium">הכנסות החודש</div>
          <div className="text-2xl font-semibold text-gold leading-none">
            {morning.currentMonth != null ? formatPrice(morning.currentMonth) : '—'}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Trend current={morning.currentMonth} prev={morning.lastMonth} />
            <span className="text-[10px] text-muted">מהחודש שעבר</span>
          </div>
        </div>

        <div className="surface px-4 py-3 flex flex-col gap-1">
          <div className="text-xs text-muted font-medium">הזמנות השנה</div>
          <div className="text-2xl font-semibold text-navy dark:text-cream leading-none">{db.totalOrders}</div>
          <div className="text-[10px] text-muted mt-0.5">ממוצע {formatPrice(db.avgOrderValue)} להזמנה</div>
        </div>

        <div className="surface px-4 py-3 flex flex-col gap-1">
          <div className="text-xs text-muted font-medium">הכנסות השנה</div>
          <div className="text-2xl font-semibold text-navy dark:text-cream leading-none">{formatPrice(db.totalRevenue)}</div>
          <div className="text-[10px] text-muted mt-0.5">לפי הזמנות במערכת</div>
        </div>

        <div className="surface px-4 py-3 flex flex-col gap-1">
          <div className="text-xs text-muted font-medium">לקוחות חוזרים</div>
          <div className="text-2xl font-semibold text-emerald-600 leading-none">{db.repeatCustomersPct}%</div>
          <div className="text-[10px] text-muted mt-0.5">מסך כלל הלקוחות</div>
        </div>
      </div>

      {/* ── Revenue charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Morning revenue by month */}
        <div className="surface p-5">
          <div className="label mb-4">הכנסות לפי חודש — מורנינג</div>
          {morningChartData.length > 0
            ? <BarChart data={morningChartData} valueKey="revenue" labelKey="month" color="bg-gold" />
            : <div className="text-xs text-muted text-center py-8">אין נתוני מורנינג</div>
          }
        </div>

        {/* DB orders by month */}
        <div className="surface p-5">
          <div className="label mb-4">הזמנות לפי חודש</div>
          {dbChartData.length > 0
            ? <BarChart data={dbChartData} valueKey="count" labelKey="month" color="bg-navy dark:bg-gold" />
            : <div className="text-xs text-muted text-center py-8">אין נתונים</div>
          }
        </div>
      </div>

      {/* ── Product insights ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Colors */}
        <div className="surface p-5 flex flex-col gap-3">
          <div className="label">צבעים פופולריים</div>
          {db.topColors.length === 0
            ? <div className="text-xs text-muted">אין נתונים</div>
            : db.topColors.map(c => (
                <RankRow
                  key={c.name}
                  name={c.name}
                  count={c.count}
                  max={maxColor}
                  color={ITEM_COLOR_MAP[c.name]?.hex}
                />
              ))
          }
        </div>

        {/* Fonts */}
        <div className="surface p-5 flex flex-col gap-3">
          <div className="label">פונטים פופולריים</div>
          {db.topFonts.length === 0
            ? <div className="text-xs text-muted">אין נתונים</div>
            : db.topFonts.map(f => (
                <RankRow key={f.name} name={f.name} count={f.count} max={maxFont} />
              ))
          }
        </div>

        {/* Sign types */}
        <div className="surface p-5 flex flex-col gap-3">
          <div className="label">סוגי שלטים</div>
          {db.topSignTypes.length === 0
            ? <div className="text-xs text-muted">אין נתונים</div>
            : db.topSignTypes.map(s => (
                <RankRow key={s.name} name={s.name} count={s.count} max={maxSign} />
              ))
          }
        </div>
      </div>

      {/* ── Activity + Delivery ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Day of week */}
        <div className="surface p-5 md:col-span-2">
          <div className="label mb-4">פעילות לפי יום בשבוע</div>
          <div className="flex flex-col gap-2.5">
            {db.byDayOfWeek.map(d => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="text-xs text-muted w-14 shrink-0">{d.day}</span>
                <div className="flex-1 bg-cream dark:bg-navy-deeper rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gold/70 rounded-full transition-all duration-500"
                    style={{ width: maxDayCount ? `${Math.round((d.count / maxDayCount) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums w-5 text-left ltr">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery breakdown */}
        <div className="surface p-5">
          <div className="label mb-4">סוג משלוח</div>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span>משלוח</span>
                <span className="font-medium tabular-nums">{db.deliveryBreakdown.delivery} ({deliveryPct}%)</span>
              </div>
              <div className="h-2.5 bg-cream dark:bg-navy-deeper rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${deliveryPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span>איסוף עצמי</span>
                <span className="font-medium tabular-nums">{db.deliveryBreakdown.pickup} ({pickupPct}%)</span>
              </div>
              <div className="h-2.5 bg-cream dark:bg-navy-deeper rounded-full overflow-hidden">
                <div className="h-full bg-navy/40 dark:bg-cream/40 rounded-full transition-all duration-500" style={{ width: `${pickupPct}%` }} />
              </div>
            </div>

            <div className="mt-2 pt-3 border-t border-cream-dark dark:border-navy-light">
              <div className="text-xs text-muted">סה״כ הזמנות השנה</div>
              <div className="text-xl font-semibold mt-0.5">{totalDelivery}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
