'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Lightbulb, CheckCircle2, Mail, MessageCircle } from 'lucide-react'
import { formatPrice, formatDateShort, formatPhone, buildWaLink, cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/StatCard'
import { BarChart } from '@/components/ui/BarChart'
import type { MarketingReport, AbandonedCheckout, MarketingAction } from '@/lib/marketing'
import type { SiteReport, FunnelStep } from '@/lib/marketing-ga'

const ACTION_STYLE: Record<MarketingAction['level'], { icon: typeof AlertTriangle; cls: string }> = {
  alert: { icon: AlertTriangle, cls: 'text-amber-600' },
  tip:   { icon: Lightbulb,     cls: 'text-gold' },
  good:  { icon: CheckCircle2,  cls: 'text-emerald-600' },
}

function weekLabel(key: string) {
  const d = new Date(key + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(steps[0]?.users ?? 0, 1)
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s, i) => {
        const change = s.prevUsers > 0 ? Math.round(((s.users - s.prevUsers) / s.prevUsers) * 100) : null
        return (
          <div key={s.event}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {i > 0 && s.stepPct != null && <span className="text-muted">{s.stepPct}% מהשלב הקודם</span>}
                <span className="font-semibold ltr">{s.users.toLocaleString('he-IL')}</span>
                {change != null && (
                  <span className={cn('ltr text-[10px]', change >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {change > 0 ? '+' : ''}{change}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 bg-cream dark:bg-navy-deeper rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all duration-500"
                   style={{ width: `${Math.max((s.users / top) * 100, 1)}%` }} />
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-muted mt-1">משתמשים, 30 הימים האחרונים. האחוז הצבעוני — שינוי מ-30 הימים שלפני.</p>
    </div>
  )
}

function StatusCell({ a }: { a: AbandonedCheckout }) {
  if (a.outcome === 'paid_later') {
    return (
      <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        {a.recovered_by_reminder ? 'חזר/ה בזכות התזכורת' : 'שילם/ה בהמשך'}
      </span>
    )
  }
  if (a.reminded_at) return <span className="badge bg-gold/10 text-gold">נשלחה תזכורת</span>
  return <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">לא שולם</span>
}

function ConsentCell({ consent }: { consent: boolean | null }) {
  if (consent === null) return <span className="text-xs text-muted">לפני האפשרות</span>
  return consent
    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Mail size={12} /> אישר/ה</span>
    : <span className="text-xs text-muted">לא אישר/ה</span>
}

export default function MarketingPage() {
  const [data, setData]       = useState<MarketingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [site, setSite]       = useState<SiteReport | null>(null)
  const [siteError, setSiteError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/marketing')
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'שגיאה'); return j })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    fetch('/api/marketing/site')
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'שגיאה'); return j })
      .then(setSite)
      .catch(e => setSiteError(e.message))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="page-header"><h1>שיווק</h1></div>
        <div className="text-center py-20 text-muted text-sm">טוען נתונים...</div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex flex-col gap-5">
        <div className="page-header"><h1>שיווק</h1></div>
        <div className="text-center py-20 text-red-600 text-sm">{error ?? 'שגיאה בטעינה'}</div>
      </div>
    )
  }

  const { kpis, weekly, abandoned } = data
  const actions = [...data.actions, ...(site?.actions ?? [])]
  const chartOrders    = weekly.map(w => ({ week: weekLabel(w.week), count: w.orders }))
  const chartAbandoned = weekly.map(w => ({ week: weekLabel(w.week), count: w.abandoned }))

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1>שיווק</h1>
          <p className="text-xs text-muted mt-0.5">30 הימים האחרונים · הזמנות מהאתר ונתוני גוגל אנליטיקס</p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="השלמת תשלום"
          value={kpis.checkoutConversion != null ? `${kpis.checkoutConversion}%` : '—'}
          sub="ממי שהגיע לדף התשלום"
          valueClass="text-gold"
        />
        <StatCard
          label="עגלות שלא שולמו"
          value={kpis.openCount}
          sub={`שווי ${formatPrice(kpis.openValue)}`}
          valueClass={kpis.openCount ? 'text-amber-600' : undefined}
        />
        <StatCard
          label="אישרו קבלת עדכונים"
          value={kpis.consentPct != null ? `${kpis.consentPct}%` : '—'}
          sub={`${kpis.remindersSent} תזכורות נשלחו`}
        />
        <StatCard
          label="הוחזרו בזכות תזכורת"
          value={kpis.recoveredOrders}
          sub={formatPrice(kpis.recoveredRevenue)}
          valueClass="text-emerald-600"
        />
      </div>

      {/* ── Recommended actions ── */}
      <div className="surface p-5">
        <div className="label mb-3">פעולות מומלצות</div>
        {actions.length === 0 ? (
          <div className="text-sm text-muted">אין כרגע משהו שדורש טיפול.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {actions.map((a, i) => {
              const { icon: Icon, cls } = ACTION_STYLE[a.level]
              return (
                <div key={i} className="flex items-start gap-3">
                  <Icon size={18} className={cn('shrink-0 mt-0.5', cls)} />
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted mt-0.5">{a.detail}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Site (Google Analytics) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface p-5">
          <div className="label mb-4">משפך האתר</div>
          {site ? <FunnelBars steps={site.funnel} />
            : <div className="text-xs text-muted text-center py-8">{siteError ?? 'טוען נתוני גוגל אנליטיקס...'}</div>}
        </div>
        <div className="surface p-5 overflow-x-auto">
          <div className="label mb-4">מאיפה מגיעים</div>
          {site ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted">
                  <th className="text-right font-medium pb-2">מקור</th>
                  <th className="text-left font-medium pb-2">כניסות</th>
                  <th className="text-left font-medium pb-2">קניות</th>
                  <th className="text-left font-medium pb-2">המרה</th>
                  <th className="text-left font-medium pb-2">הכנסה</th>
                </tr>
              </thead>
              <tbody>
                {site.sources.map(r => (
                  <tr key={r.channel} className="border-t border-cream-dark dark:border-navy-light">
                    <td className="py-2">{r.label}</td>
                    <td className="py-2 text-left ltr tabular-nums">{r.sessions.toLocaleString('he-IL')}</td>
                    <td className="py-2 text-left ltr tabular-nums">{r.purchases}</td>
                    <td className="py-2 text-left ltr tabular-nums">{r.convPct != null ? `${r.convPct}%` : '—'}</td>
                    <td className="py-2 text-left ltr tabular-nums">{formatPrice(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-xs text-muted text-center py-8">{siteError ?? 'טוען...'}</div>}
          {site && <p className="text-[10px] text-muted mt-2">לפי המקור של הביקור שבו נקנה. מי שראה מודעה ונכנס אחר כך מאינסטגרם נספר כ"רשתות חברתיות".</p>}
        </div>
      </div>

      {/* ── Weekly trend ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface p-5">
          <div className="label mb-4">הזמנות מהאתר לפי שבוע</div>
          <BarChart data={chartOrders} valueKey="count" labelKey="week" color="bg-navy dark:bg-gold" />
        </div>
        <div className="surface p-5">
          <div className="label mb-4">עגלות שלא שולמו לפי שבוע</div>
          <BarChart data={chartAbandoned} valueKey="count" labelKey="week" color="bg-amber-500" />
        </div>
      </div>

      {/* ── Abandoned checkouts ── */}
      <div className="surface overflow-x-auto">
        <div className="px-5 pt-5 pb-3">
          <div className="label">הגיעו לתשלום ולא שילמו</div>
          <p className="text-xs text-muted mt-1">
            פנייה יזומה בוואטסאפ/SMS מותרת רק למי שאישר/ה קבלת עדכונים (חוק הספאם, סעיף 30א).
          </p>
        </div>
        {abandoned.length === 0 ? (
          <div className="text-sm text-muted text-center py-10">אין נטישות ב-30 הימים האחרונים</div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>לקוח/ה</th>
                <th>פריטים</th>
                <th>סכום</th>
                <th>עדכונים</th>
                <th>מצב</th>
              </tr>
            </thead>
            <tbody>
              {abandoned.map(a => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-xs">{formatDateShort(a.created_at)}</td>
                  <td>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {a.phone && <span className="ltr">{formatPhone(a.phone)}</span>}
                      {a.phone && a.consent === true && a.outcome === 'open' && (
                        <a href={buildWaLink(a.phone, `היי ${a.name.split(' ')[0]}, ראינו שלא הושלמה ההזמנה שלך באתר MEZU. אפשר לעזור במשהו?`)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline flex items-center gap-0.5">
                          <MessageCircle size={12} /> וואטסאפ
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="text-xs text-muted max-w-[220px] truncate" title={a.items.join(', ')}>
                    {a.items.join(', ') || '—'}
                  </td>
                  <td className="ltr text-sm tabular-nums whitespace-nowrap">{formatPrice(a.total)}</td>
                  <td><ConsentCell consent={a.consent} /></td>
                  <td><StatusCell a={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
