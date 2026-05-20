'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import { formatPrice, formatDate, cn } from '@/lib/utils'

interface HypTxn {
  id:           string
  date:         string
  time?:        string
  amount:       number
  client_name?: string
  client_phone?:string
  status?:      string
  order_ref?:   string
}
interface Order {
  id:           string
  order_number: number
  created_at:   string
  total_price:  number
  invoice_id?:  string
  customer?:    { name?: string } | null
}
interface Resp {
  from: string
  to:   string
  totals: {
    hyp_total: number
    orders_total: number
    matched_count: number
    hyp_only_count: number
    orders_only_count: number
  }
  matched:     Array<{ hyp: HypTxn; order: Order }>
  hyp_only:    Array<{ hyp: HypTxn }>
  orders_only: Order[]
  error?:      string
  raw?:        string
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function monthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function HypReconciliationPage() {
  const [from, setFrom]       = useState(monthStart())
  const [to, setTo]           = useState(today())
  const [data, setData]       = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    setError(null)
    fetch(`/api/hyp/transactions?from=${from}&to=${to}`)
      .then(async r => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
        return json
      })
      .then(setData)
      .catch(e => setError(e?.message || 'שגיאה'))
      .finally(() => setLoading(false))
  }
  useEffect(fetchData, [from, to])

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Link href="/finance" className="text-muted hover:text-navy dark:hover:text-cream"><ArrowRight size={16} /></Link>
          <div>
            <h1>השוואת HYP</h1>
            <p className="text-xs text-muted mt-0.5">כל החיובים בכרטיס/אשראי מול ההזמנות במערכת</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input className="input text-sm ltr py-1.5 w-[140px]" type="date" value={from} onChange={e => setFrom(e.target.value)} dir="ltr" />
          <span className="text-muted text-xs">→</span>
          <input className="input text-sm ltr py-1.5 w-[140px]" type="date" value={to}   onChange={e => setTo(e.target.value)}   dir="ltr" />
        </div>
      </div>

      {loading && <div className="text-center py-12 text-muted text-sm">טוען עסקאות מ-HYP...</div>}

      {error && (
        <div className="surface px-4 py-4 text-sm text-red-600 dark:text-red-300">
          {error}
          <div className="text-[11px] text-muted mt-2">בדוק שמשתני YAADPAY_MASOF / YAADPAY_KEY / YAADPAY_PASSP מוגדרים ב-Vercel.</div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label={`סה״כ ב-HYP (${data.totals.matched_count + data.totals.hyp_only_count})`} value={formatPrice(data.totals.hyp_total)} tone="emerald" />
            <Card label="סה״כ הזמנות עם חשבונית" value={formatPrice(data.totals.orders_total)} tone="navy" />
            <Card label="עסקאות ללא הזמנה" value={String(data.totals.hyp_only_count)} tone={data.totals.hyp_only_count > 0 ? 'amber' : 'muted'} sub="HYP בלבד" />
            <Card label="הזמנות ללא עסקה" value={String(data.totals.orders_only_count)} tone={data.totals.orders_only_count > 0 ? 'red' : 'muted'} sub="חסרות ב-HYP" />
          </div>

          {/* HYP-only — most interesting */}
          {data.hyp_only.length > 0 && (
            <Section
              icon={<AlertTriangle size={14} className="text-amber-600" />}
              title="עסקאות ב-HYP שאינן באתר"
              hint="חיובים שנעשו ידנית, בטלפון או דרך פאנל HYP — לא מקושרים לאף הזמנה במערכת"
            >
              <Tbl rows={data.hyp_only.map(x => x.hyp)} />
            </Section>
          )}

          {/* Orders-only — data integrity */}
          {data.orders_only.length > 0 && (
            <Section
              icon={<AlertTriangle size={14} className="text-red-500" />}
              title="הזמנות במערכת ללא עסקה ב-HYP"
              hint="הזמנה נשמרה עם invoice_id אך HYP לא מחזיר אותה. בדוק זיהוי שגוי."
            >
              <OrdersTbl orders={data.orders_only} />
            </Section>
          )}

          {/* Matched */}
          <Section
            icon={<CheckCircle2 size={14} className="text-emerald-600" />}
            title={`הזמנות תואמות (${data.totals.matched_count})`}
            hint="עסקאות שיש להן הזמנה תואמת באתר"
          >
            <MatchedTbl rows={data.matched} />
          </Section>
        </>
      )}
    </div>
  )
}

function Card({ label, value, tone, sub }: { label: string; value: string; tone: 'emerald' | 'navy' | 'amber' | 'red' | 'muted'; sub?: string }) {
  const colorClass = {
    emerald: 'text-emerald-600',
    navy:    'text-navy dark:text-cream',
    amber:   'text-amber-600',
    red:     'text-red-500',
    muted:   'text-muted',
  }[tone]
  return (
    <div className="surface px-4 py-3 flex flex-col gap-1">
      <div className="text-xs text-muted font-medium truncate">{label}</div>
      <div className={cn('text-2xl font-semibold ltr leading-none', colorClass)}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="surface p-5 flex flex-col gap-3">
      <div>
        <div className="label flex items-center gap-2">{icon}{title}</div>
        <p className="text-[11px] text-muted mt-1">{hint}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function Tbl({ rows }: { rows: HypTxn[] }) {
  if (rows.length === 0) return <div className="text-xs text-muted text-center py-4">אין עסקאות</div>
  return (
    <table className="crm-table">
      <thead>
        <tr>
          <th>תאריך</th><th>שם</th><th>טלפון</th><th>סטטוס</th><th className="text-left">סכום</th><th>HYP ID</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(t => (
          <tr key={t.id}>
            <td className="ltr text-xs whitespace-nowrap">{formatDate(t.date)}{t.time ? ` ${t.time}` : ''}</td>
            <td className="text-sm">{t.client_name || '—'}</td>
            <td className="ltr text-xs text-muted">{t.client_phone || '—'}</td>
            <td><span className="text-[11px] text-muted">{t.status || '—'}</span></td>
            <td className="text-left ltr font-medium tabular-nums">{formatPrice(t.amount)}</td>
            <td className="ltr text-[11px] text-muted">{t.id}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function OrdersTbl({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <div className="text-xs text-muted text-center py-4">—</div>
  return (
    <table className="crm-table">
      <thead>
        <tr><th>תאריך</th><th>הזמנה</th><th>לקוח</th><th className="text-left">סכום</th><th>invoice_id</th></tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id}>
            <td className="ltr text-xs whitespace-nowrap">{formatDate(o.created_at)}</td>
            <td className="ltr">#{o.order_number}</td>
            <td className="text-sm">{o.customer?.name || '—'}</td>
            <td className="text-left ltr font-medium tabular-nums">{formatPrice(Number(o.total_price))}</td>
            <td className="ltr text-[11px] text-muted">{o.invoice_id}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MatchedTbl({ rows }: { rows: Array<{ hyp: HypTxn; order: Order }> }) {
  if (rows.length === 0) return <div className="text-xs text-muted text-center py-4">—</div>
  return (
    <table className="crm-table">
      <thead>
        <tr><th>תאריך</th><th>הזמנה</th><th>לקוח</th><th className="text-left">HYP</th><th className="text-left">מערכת</th><th>סטטוס</th></tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const mismatch = Math.abs((r.hyp.amount || 0) - Number(r.order.total_price || 0)) > 0.5
          return (
            <tr key={r.hyp.id}>
              <td className="ltr text-xs whitespace-nowrap">{formatDate(r.hyp.date)}</td>
              <td className="ltr">#{r.order.order_number}</td>
              <td className="text-sm">{r.order.customer?.name || r.hyp.client_name || '—'}</td>
              <td className="text-left ltr font-medium tabular-nums">{formatPrice(r.hyp.amount)}</td>
              <td className="text-left ltr font-medium tabular-nums">{formatPrice(Number(r.order.total_price))}</td>
              <td>
                {mismatch
                  ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">פער ₪{Math.abs(r.hyp.amount - Number(r.order.total_price)).toFixed(2)}</span>
                  : <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={11} /> תואם</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
