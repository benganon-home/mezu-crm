// ─── Marketing report (abandoned checkouts, recovery, actions) ─────
//
// Pure functions over rows the /api/marketing route loads, so the numbers
// can be checked without a database.
//
// Source of truth: the store writes a checkout_sessions row when a customer
// is sent to HYP, and deletes it when the paid order is created. A row that
// still exists is a checkout that was never paid in THAT attempt — the
// customer may still have paid later in a new attempt (matched by phone or
// email to an order created after it).

export interface SessionRow  { id: string; created_at: string; data: any }
export interface OrderRow    { id: string; customer_id: string | null; created_at: string; total_price: number | null; source: string | null; status: string | null }
export interface CustomerRow { id: string; phone: string | null; email: string | null }

export interface AbandonedCheckout {
  id:          string
  created_at:  string
  name:        string
  phone:       string
  email:       string | null
  total:       number
  items:       string[]
  consent:     boolean | null      // null = checkout from before the opt-in existed
  reminded_at: string | null
  outcome:     'open' | 'paid_later'
  paid_at:     string | null
  paid_total:  number | null
  recovered_by_reminder: boolean
}

export interface WeekPoint { week: string; orders: number; revenue: number; abandoned: number }

export interface MarketingAction { level: 'alert' | 'tip' | 'good'; title: string; detail: string }

export interface MarketingReport {
  kpis: {
    openCount:          number
    openValue:          number
    checkoutConversion: number | null   // % of checkout attempts that ended in a paid order (30 days)
    consentPct:         number | null   // of checkouts that saw the opt-in
    remindersSent:      number
    recoveredOrders:    number
    recoveredRevenue:   number
  }
  abandoned: AbandonedCheckout[]
  weekly:    WeekPoint[]
  actions:   MarketingAction[]
}

const DAY = 86_400_000

export function normPhone(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '').replace(/^972/, '0')
}
const normEmail = (e: string | null | undefined) => String(e || '').trim().toLowerCase()

// Sunday-start week key (Israeli business week), as YYYY-MM-DD of that Sunday.
export function weekKey(iso: string): string {
  const d = new Date(iso)
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay()))
  return s.toISOString().slice(0, 10)
}

export function buildMarketingReport(
  sessions: SessionRow[], orders: OrderRow[], customers: CustomerRow[], now: Date,
): MarketingReport {
  const since30 = now.getTime() - 30 * DAY
  const paidOrders = orders.filter(o => o.status !== 'cancelled')

  // Customer ids reachable by phone / email.
  const byPhone = new Map<string, string[]>()
  const byEmail = new Map<string, string[]>()
  for (const c of customers) {
    const p = normPhone(c.phone), e = normEmail(c.email)
    if (p) byPhone.set(p, [...(byPhone.get(p) ?? []), c.id])
    if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), c.id])
  }
  const ordersByCustomer = new Map<string, OrderRow[]>()
  for (const o of paidOrders) {
    if (!o.customer_id) continue
    ordersByCustomer.set(o.customer_id, [...(ordersByCustomer.get(o.customer_id) ?? []), o])
  }

  const abandoned: AbandonedCheckout[] = sessions
    .filter(s => new Date(s.created_at).getTime() >= since30)
    .map(s => {
      const c = s.data?.customer ?? {}
      const ids = new Set([...(byPhone.get(normPhone(c.phone)) ?? []), ...(byEmail.get(normEmail(c.email)) ?? [])])
      const later = Array.from(ids)
        .flatMap(id => ordersByCustomer.get(id) ?? [])
        .filter(o => o.created_at >= s.created_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
      const reminded = s.data?.reminded_at ?? null
      const lines = (s.data?.cartSnapshot ?? s.data?.orderItems ?? []) as any[]
      return {
        id:          s.id,
        created_at:  s.created_at,
        name:        c.name || '—',
        phone:       c.phone || '',
        email:       c.email || null,
        total:       Number(s.data?.totalPrice) || 0,
        items:       lines.map(i => i.product_name || i.item_name).filter(Boolean),
        consent:     s.data?.consent ? s.data.consent.marketing === true : null,
        reminded_at: reminded,
        outcome:     later ? 'paid_later' as const : 'open' as const,
        paid_at:     later?.created_at ?? null,
        paid_total:  later ? Number(later.total_price) || 0 : null,
        recovered_by_reminder: !!(later && reminded && later.created_at >= reminded),
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const open = abandoned.filter(a => a.outcome === 'open')
  const sawOptIn = abandoned.filter(a => a.consent !== null)
  const recovered = abandoned.filter(a => a.recovered_by_reminder)
  const storeOrders30 = paidOrders.filter(o => o.source === 'store' && new Date(o.created_at).getTime() >= since30)
  // Unique open attempts per person, so one customer retrying 3 times counts once.
  const openPeople = new Set(open.map(a => normPhone(a.phone) || normEmail(a.email) || a.id)).size
  const attempts = storeOrders30.length + openPeople

  // Last 8 weeks, oldest first.
  const weeks: WeekPoint[] = []
  for (let i = 7; i >= 0; i--) {
    weeks.push({ week: weekKey(new Date(now.getTime() - i * 7 * DAY).toISOString()), orders: 0, revenue: 0, abandoned: 0 })
  }
  const wIdx = new Map(weeks.map((w, i) => [w.week, i]))
  for (const o of paidOrders) {
    if (o.source !== 'store') continue
    const i = wIdx.get(weekKey(o.created_at)); if (i == null) continue
    weeks[i].orders++; weeks[i].revenue += Number(o.total_price) || 0
  }
  for (const s of sessions) {
    const i = wIdx.get(weekKey(s.created_at)); if (i == null) continue
    weeks[i].abandoned++
  }
  for (const w of weeks) w.revenue = Math.round(w.revenue * 100) / 100

  const report: MarketingReport = {
    kpis: {
      openCount:          open.length,
      openValue:          Math.round(open.reduce((s, a) => s + a.total, 0) * 100) / 100,
      checkoutConversion: attempts ? Math.round((storeOrders30.length / attempts) * 100) : null,
      consentPct:         sawOptIn.length ? Math.round((sawOptIn.filter(a => a.consent).length / sawOptIn.length) * 100) : null,
      remindersSent:      abandoned.filter(a => a.reminded_at).length,
      recoveredOrders:    recovered.length,
      recoveredRevenue:   Math.round(recovered.reduce((s, a) => s + (a.paid_total ?? 0), 0) * 100) / 100,
    },
    abandoned,
    weekly: weeks,
    actions: [],
  }
  report.actions = buildActions(report, now)
  return report
}

// Rule-based recommendations. Each rule only fires on enough data to mean something.
export function buildActions(r: MarketingReport, now: Date): MarketingAction[] {
  const out: MarketingAction[] = []
  const last24 = r.abandoned.filter(a => a.outcome === 'open' && now.getTime() - new Date(a.created_at).getTime() < DAY)
  if (last24.length > 0) {
    out.push({
      level: 'alert',
      title: `${last24.length} נטשו את התשלום ב-24 השעות האחרונות`,
      detail: `שווי ₪${Math.round(last24.reduce((s, a) => s + a.total, 0))}. מי שאישר/ה קבלת עדכונים יקבל/תקבל מייל תזכורת אוטומטי בערב.`,
    })
  }

  // This week's pace vs the 4 weeks before it (full weeks only).
  const full = r.weekly.slice(0, -1)
  const thisWeek = full.at(-1)
  const prior = full.slice(-5, -1)
  const avg = prior.length ? prior.reduce((s, w) => s + w.orders, 0) / prior.length : 0
  if (thisWeek && avg >= 4) {
    const change = Math.round(((thisWeek.orders - avg) / avg) * 100)
    if (change <= -30) {
      out.push({ level: 'alert', title: `ירידה של ${-change}% בהזמנות בשבוע שעבר`, detail: `${thisWeek.orders} הזמנות לעומת ממוצע של ${avg.toFixed(1)} בארבעת השבועות שלפניו. כדאי לבדוק את המודעה הפעילה ואת האתר.` })
    } else if (change >= 30) {
      out.push({ level: 'good', title: `עלייה של ${change}% בהזמנות בשבוע שעבר`, detail: `${thisWeek.orders} הזמנות לעומת ממוצע של ${avg.toFixed(1)}. זה הזמן לוודא שיש מלאי פילמנט וזמן הדפסה.` })
    }
  }

  if (r.kpis.checkoutConversion != null && r.kpis.checkoutConversion < 60) {
    out.push({ level: 'tip', title: `רק ${r.kpis.checkoutConversion}% ממי שמגיע לתשלום משלים אותו`, detail: 'בדקו את דף התשלום ב-HYP מהנייד, ואת עלות המשלוח שמתווספת בסוף — שם רוב הנטישות קורות.' })
  }

  const sawOptIn = r.abandoned.filter(a => a.consent !== null).length
  if (sawOptIn >= 10 && r.kpis.consentPct != null && r.kpis.consentPct < 20) {
    out.push({ level: 'tip', title: `רק ${r.kpis.consentPct}% מאשרים קבלת עדכונים`, detail: 'אפשר לנסח את תיבת הסימון בצורה מזמינה יותר (למשל להזכיר שיש קופונים למנויים).' })
  }

  if (r.kpis.recoveredOrders > 0) {
    out.push({ level: 'good', title: `מיילי התזכורת החזירו ${r.kpis.recoveredOrders} הזמנות`, detail: `₪${Math.round(r.kpis.recoveredRevenue)} שהיו הולכים לאיבוד.` })
  }
  return out
}
