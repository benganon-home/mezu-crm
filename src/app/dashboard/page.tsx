'use client'

// דשבורד — monthly P&L built from live order data + the editable cost model.
// Month picker defaults to the current month; costs (boxes, stickers, shipping,
// filament ₪/kg, fixed monthlies, tax %) are editable rows in dashboard_costs.

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, Wallet, Receipt, Landmark, PiggyBank, Plus, Trash2,
  ChevronDown, ChevronUp, Pencil, AlertTriangle, CalendarDays,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'

interface Line { id: string; label: string; kind: string; amount: number; detail: string; total: number }
interface CostRule {
  id: string; label: string; kind: string; category: string | null
  amount: number; sort: number; is_active: boolean
}
interface DashboardData {
  month: string
  isCurrent: boolean
  monthsAvailable: string[]
  revenue: {
    gross: number; net: number; orders: number; deliveryOrders: number; pickupOrders: number
    items: number; itemsByCategory: Record<string, number>; avgOrderGross: number; cancelledOrders: number
  }
  filament: { totalKg: number; itemsMissingWeight: number }
  costLines: Line[]
  totalCosts: number
  contribution: number
  taxLines: Line[]
  totalTax: number
  netAfterTax: number
  projection: { grossRevenue: number; netAfterTax: number } | null
}

const KIND_LABELS: Record<string, string> = {
  per_order:               'לכל הזמנה',
  per_delivery_order:      'לכל משלוח',
  per_category_item:       'לפריט בקטגוריה',
  monthly_fixed:           'קבוע חודשי',
  filament_per_kg:         'פילמנט ₪ לק״ג',
  percent_of_contribution: '% מהרווח (מיסים)',
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

export default function DashboardPage() {
  const [month, setMonth] = useState<string | null>(null) // null = current
  const [data, setData]   = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCosts, setShowCosts] = useState(false)

  const fetchData = async (m?: string | null) => {
    setLoading(true)
    const res = await fetch(`/api/dashboard${m ? `?month=${m}` : ''}`)
    const d = await res.json()
    if (res.ok) setData(d)
    setLoading(false)
  }
  useEffect(() => { fetchData(month) }, [month])

  const cats = useMemo(
    () => Object.entries(data?.revenue.itemsByCategory ?? {}).sort((a, b) => b[1] - a[1]),
    [data],
  )

  if (loading && !data) return <div className="text-sm text-muted py-10">טוען…</div>
  if (!data) return <div className="text-sm text-muted py-10">שגיאה בטעינת הדשבורד</div>

  return (
    <div className={cn('flex flex-col gap-5', loading && 'opacity-60 pointer-events-none')}>
      {/* Header + month picker */}
      <div className="page-header">
        <div>
          <h1>דשבורד</h1>
          <p className="text-xs text-muted mt-0.5">
            {monthLabel(data.month)} · {data.revenue.orders} הזמנות · {data.revenue.items} פריטים
            {data.isCurrent && ' · חודש נוכחי'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!data.isCurrent && (
            <button onClick={() => setMonth(null)} className="btn-secondary flex items-center gap-1.5 text-xs">
              <CalendarDays size={13} /> החודש הנוכחי
            </button>
          )}
          <select
            className="input text-sm !w-auto"
            value={data.month}
            onChange={e => setMonth(e.target.value)}
          >
            {data.monthsAvailable.map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={TrendingUp} label="מחזור (כולל מע״מ)" value={formatPrice(data.revenue.gross)} sub={`${data.revenue.orders} הזמנות · ממוצע ${formatPrice(data.revenue.avgOrderGross)}`} />
        <Stat icon={Wallet}     label="הכנסה נטו (לפני מע״מ)" value={formatPrice(data.revenue.net)} />
        <Stat icon={Receipt}    label="עלויות" value={`−${formatPrice(data.totalCosts)}`} sub={`${data.costLines.length} סעיפים`} tone="muted" />
        <Stat icon={Landmark}   label="רווח תפעולי" value={formatPrice(data.contribution)} sub={data.revenue.net > 0 ? `${Math.round(data.contribution / data.revenue.net * 100)}% מההכנסה נטו` : undefined} tone={data.contribution >= 0 ? 'good' : 'bad'} />
        <Stat icon={PiggyBank}  label="נטו אחרי מיסים (אומדן)" value={formatPrice(data.netAfterTax)} sub={`מיסים משוערים −${formatPrice(data.totalTax)}`} tone={data.netAfterTax >= 0 ? 'good' : 'bad'} />
      </div>

      {/* Current-month projection */}
      {data.projection && (
        <div className="rounded-lg bg-gold/10 border border-gold/25 px-4 py-2.5 text-sm">
          קצב חודשי משוער (לפי הימים שחלפו): מחזור ~{formatPrice(data.projection.grossRevenue)} · נטו אחרי מיסים ~{formatPrice(data.projection.netAfterTax)}
        </div>
      )}

      {/* Missing-weights warning */}
      {data.filament.itemsMissingWeight > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          <AlertTriangle size={13} className="shrink-0" />
          עלות הפילמנט חלקית — ל-{data.filament.itemsMissingWeight} פריטים אין משקל מוגדר (מסך חומרי גלם → משקלי מוצרים).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* P&L breakdown */}
        <div className="surface overflow-hidden lg:col-span-2">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">דו״ח רווח והפסד — {monthLabel(data.month)}</div>
          <div className="divide-y divide-line/70 text-sm">
            <Row label="מחזור (כולל מע״מ)" value={data.revenue.gross} bold />
            <Row label="בניכוי מע״מ (18%)" value={data.revenue.net - data.revenue.gross} />
            <Row label="הכנסה נטו" value={data.revenue.net} bold />
            {data.costLines.map(l => (
              <Row key={l.id} label={l.label} sub={l.detail} value={-l.total} />
            ))}
            <Row label="סה״כ עלויות" value={-data.totalCosts} bold />
            <Row label="רווח תפעולי" value={data.contribution} bold highlight />
            {data.taxLines.map(l => (
              <Row key={l.id} label={l.label} sub={l.detail} value={-l.total} />
            ))}
            <Row label="נטו אחרי מיסים (אומדן)" value={data.netAfterTax} bold highlight />
          </div>
        </div>

        {/* Month mix */}
        <div className="flex flex-col gap-5">
          <div className="surface overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">תמהיל החודש</div>
            <div className="divide-y divide-line/70 text-sm">
              <MixRow label="משלוחים" value={`${data.revenue.deliveryOrders} הזמנות`} />
              <MixRow label="איסוף עצמי" value={`${data.revenue.pickupOrders} הזמנות`} />
              {cats.map(([cat, n]) => <MixRow key={cat} label={cat} value={`${n} פריטים`} />)}
              <MixRow label="פילמנט (משוקלל)" value={`${data.filament.totalKg} ק״ג`} />
              {data.revenue.cancelledOrders > 0 && <MixRow label="הזמנות שבוטלו" value={String(data.revenue.cancelledOrders)} />}
            </div>
          </div>
        </div>
      </div>

      {/* Cost model editor */}
      <div className="surface overflow-hidden">
        <button onClick={() => setShowCosts(v => !v)} className="flex w-full items-center justify-between px-4 py-3 text-right">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Pencil size={14} strokeWidth={1.6} className="text-gold" />
            ניהול סעיפי עלות
          </span>
          {showCosts ? <ChevronUp size={15} className="text-muted" /> : <ChevronDown size={15} className="text-muted" />}
        </button>
        {showCosts && <CostEditor onChanged={() => fetchData(month)} />}
      </div>
    </div>
  )
}

// ─── Small building blocks ──────────────────────────────────────────

function Stat({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'muted'
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] text-muted mb-1.5">
        <Icon size={13} strokeWidth={1.6} className="text-gold" />
        {label}
      </div>
      <div className={cn(
        'text-xl font-semibold ltr text-right tabular-nums',
        tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
        tone === 'bad' && 'text-red-600 dark:text-red-400',
        tone === 'muted' && 'text-muted',
      )}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-1">{sub}</div>}
    </div>
  )
}

function Row({ label, sub, value, bold, highlight }: {
  label: string; sub?: string; value: number; bold?: boolean; highlight?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-2', highlight && 'bg-gold/8 dark:bg-gold/10')}>
      <div className="min-w-0">
        <span className={cn(bold && 'font-semibold')}>{label}</span>
        {sub && <span className="block text-[11px] text-muted">{sub}</span>}
      </div>
      <span className={cn('ltr tabular-nums shrink-0', bold && 'font-semibold', value < 0 && 'text-red-600/90 dark:text-red-400')}>
        {value < 0 ? `−${formatPrice(Math.abs(value))}` : formatPrice(value)}
      </span>
    </div>
  )
}

function MixRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

// ─── Cost model editor ──────────────────────────────────────────────

function CostEditor({ onChanged }: { onChanged: () => void }) {
  const [rules, setRules] = useState<CostRule[]>([])
  const [adding, setAdding] = useState(false)
  const [newRule, setNewRule] = useState({ label: '', kind: 'monthly_fixed', category: '', amount: '' })

  const load = () => fetch('/api/dashboard/costs').then(r => r.json()).then(d => setRules(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/dashboard/costs/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    await load(); onChanged()
  }
  const remove = async (id: string) => {
    await fetch(`/api/dashboard/costs/${id}`, { method: 'DELETE' })
    await load(); onChanged()
  }
  const add = async () => {
    if (!newRule.label.trim()) return
    await fetch('/api/dashboard/costs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: newRule.label, kind: newRule.kind,
        category: newRule.kind === 'per_category_item' ? newRule.category : null,
        amount: Number(newRule.amount) || 0,
      }),
    })
    setNewRule({ label: '', kind: 'monthly_fixed', category: '', amount: '' })
    setAdding(false)
    await load(); onChanged()
  }

  return (
    <div className="border-t border-line">
      <p className="px-4 pt-3 text-xs text-muted">
        הסכומים לפני מע״מ (המע״מ על ההוצאות מתקזז). שינוי נשמר מיד ומחושב מחדש בדו״ח.
      </p>
      <div className="divide-y divide-line/60">
        {rules.map(r => (
          <div key={r.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5', !r.is_active && 'opacity-50')}>
            <input
              className="input !w-52 !py-1 text-sm"
              defaultValue={r.label}
              onBlur={e => e.target.value !== r.label && patch(r.id, { label: e.target.value })}
            />
            <span className="text-[11px] text-muted w-28">{KIND_LABELS[r.kind] ?? r.kind}{r.category ? ` · ${r.category}` : ''}</span>
            <label className="flex items-center gap-1 text-xs text-muted">
              {r.kind === 'percent_of_contribution' ? '%' : '₪'}
              <input
                className="input !w-24 !py-1 text-sm ltr"
                inputMode="decimal"
                defaultValue={String(r.amount)}
                onBlur={e => Number(e.target.value) !== r.amount && patch(r.id, { amount: e.target.value })}
              />
            </label>
            <div className="mr-auto flex items-center gap-2">
              <button onClick={() => patch(r.id, { is_active: !r.is_active })} className="btn-ghost !px-2 !py-1 text-xs">
                {r.is_active ? 'השבתה' : 'הפעלה'}
              </button>
              <button onClick={() => remove(r.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted/50 hover:text-red-500" title="מחיקה">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3">
        {adding ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label mb-1 block text-[10px]">שם הסעיף</label>
              <input className="input !w-44 text-sm" value={newRule.label} onChange={e => setNewRule(n => ({ ...n, label: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1 block text-[10px]">סוג</label>
              <select className="input text-sm" value={newRule.kind} onChange={e => setNewRule(n => ({ ...n, kind: e.target.value }))}>
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {newRule.kind === 'per_category_item' && (
              <div>
                <label className="label mb-1 block text-[10px]">קטגוריה</label>
                <input className="input !w-32 text-sm" placeholder="מזוזות" value={newRule.category} onChange={e => setNewRule(n => ({ ...n, category: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="label mb-1 block text-[10px]">{newRule.kind === 'percent_of_contribution' ? 'אחוז' : 'סכום ₪'}</label>
              <input className="input !w-24 text-sm ltr" inputMode="decimal" value={newRule.amount} onChange={e => setNewRule(n => ({ ...n, amount: e.target.value }))} />
            </div>
            <button onClick={add} className="btn-primary !py-2 text-xs">הוספה</button>
            <button onClick={() => setAdding(false)} className="btn-ghost !py-2 text-xs">ביטול</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="btn-secondary flex items-center gap-1.5 text-xs">
            <Plus size={13} /> סעיף עלות חדש
          </button>
        )}
      </div>
    </div>
  )
}
