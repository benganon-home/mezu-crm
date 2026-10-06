// ─── Site funnel + traffic sources from GA4 ─────────────────────────
//
// Pure shaping of GA rows so the numbers can be checked without GA. The
// funnel counts USERS who fired each event (not event counts), last 30 days
// vs the 30 days before. Purchase is sent server-side by the store, so it
// matches real orders closely.

import type { GARow } from '@/lib/ga'
import type { MarketingAction } from '@/lib/marketing'

export const FUNNEL_STEPS = [
  { event: 'session_start',  label: 'נכנסו לאתר' },
  { event: 'view_item',      label: 'צפו במוצר' },
  { event: 'add_to_cart',    label: 'הוסיפו לסל' },
  { event: 'begin_checkout', label: 'התחילו הזמנה' },
  { event: 'purchase',       label: 'שילמו' },
] as const

export const CHANNEL_LABELS: Record<string, string> = {
  'Paid Social':     'מודעות (פייסבוק/אינסטגרם)',
  'Organic Social':  'רשתות חברתיות (לא ממומן)',
  'Organic Search':  'חיפוש בגוגל',
  'Direct':          'כניסה ישירה',
  'Referral':        'הפניה מאתר אחר',
  'Unassigned':      'לא מזוהה',
  'AI Assistant':    'עוזרי AI',
  'Organic Shopping':'גוגל שופינג',
  'Email':           'מייל',
}

export interface FunnelStep { event: string; label: string; users: number; prevUsers: number; stepPct: number | null }
export interface SourceRow  { channel: string; label: string; sessions: number; addToCarts: number; purchases: number; revenue: number; convPct: number | null }
export interface SiteReport { funnel: FunnelStep[]; sources: SourceRow[]; actions: MarketingAction[] }

// rows: dims [eventName, dateRange('cur'|'prev')], mets [totalUsers]
export function buildFunnel(rows: GARow[]): FunnelStep[] {
  const get = (ev: string, range: string) => rows.find(r => r.dims[0] === ev && r.dims[1] === range)?.mets[0] ?? 0
  return FUNNEL_STEPS.map((s, i) => {
    const users = get(s.event, 'cur')
    const before = i > 0 ? get(FUNNEL_STEPS[i - 1].event, 'cur') : 0
    return {
      event: s.event, label: s.label, users,
      prevUsers: get(s.event, 'prev'),
      stepPct: i > 0 && before > 0 ? Math.round((users / before) * 1000) / 10 : null,
    }
  })
}

// rows: dims [channel], mets [sessions, addToCarts, ecommercePurchases, purchaseRevenue]
export function buildSources(rows: GARow[]): SourceRow[] {
  return rows
    .map(r => {
      const [sessions, addToCarts, purchases, revenue] = r.mets
      return {
        channel: r.dims[0], label: CHANNEL_LABELS[r.dims[0]] ?? r.dims[0],
        sessions, addToCarts, purchases, revenue: Math.round(revenue),
        convPct: sessions > 0 ? Math.round((purchases / sessions) * 1000) / 10 : null,
      }
    })
    .filter(r => r.sessions > 0 || r.purchases > 0)
    .sort((a, b) => b.sessions - a.sessions)
}

export function buildSiteActions(funnel: FunnelStep[], sources: SourceRow[]): MarketingAction[] {
  const out: MarketingAction[] = []

  // Weakest step of the funnel (after "entered the site", which is ad-driven noise).
  const steps = funnel.slice(2).filter(s => s.stepPct != null && funnel[funnel.indexOf(s) - 1].users >= 30)
  const weakest = steps.sort((a, b) => (a.stepPct ?? 100) - (b.stepPct ?? 100))[0]
  if (weakest && (weakest.stepPct ?? 100) < 50) {
    const from = funnel[funnel.findIndex(s => s.event === weakest.event) - 1]
    out.push({
      level: 'tip',
      title: `הנפילה הגדולה במשפך: מ"${from.label}" ל"${weakest.label}" (${weakest.stepPct}%)`,
      detail: weakest.event === 'add_to_cart'
        ? 'אנשים צופים במוצרים אבל לא מוסיפים לסל — שווה לבדוק תמונות, מחיר ובהירות המבצע בדף המוצר.'
        : weakest.event === 'begin_checkout'
          ? 'אנשים מוסיפים לסל ולא ממשיכים להזמנה — שווה לבדוק את דף העגלה ואת עלות המשלוח שמופיעה בו.'
          : 'בדקו את השלב הזה באתר מהנייד.',
    })
  }

  // Paid traffic converting far below the site's other traffic.
  const paid = sources.find(s => s.channel === 'Paid Social')
  const rest = sources.filter(s => s.channel !== 'Paid Social')
  const restSessions = rest.reduce((s, r) => s + r.sessions, 0)
  const restConv = restSessions ? rest.reduce((s, r) => s + r.purchases, 0) / restSessions * 100 : 0
  if (paid && paid.sessions >= 300 && paid.convPct != null && restConv > 0 && paid.convPct < restConv / 3) {
    out.push({
      level: 'alert',
      title: `מבקרים מהמודעות קונים פי ${Math.round(restConv / Math.max(paid.convPct, 0.01))} פחות משאר המבקרים`,
      detail: `${paid.convPct}% מהמודעות לעומת ${restConv.toFixed(1)}% מכל השאר. המודעה מביאה הרבה כניסות שלא קונות — כדאי לבדוק את המודעה ואת קהל היעד.`,
    })
  }

  const entered = funnel[0]
  if (entered.prevUsers >= 100 && entered.users > entered.prevUsers * 1.5) {
    const purchase = funnel.at(-1)!
    if (purchase.users <= purchase.prevUsers) {
      out.push({
        level: 'alert',
        title: 'יותר כניסות, לא יותר קונים',
        detail: `${entered.users} נכנסו לעומת ${entered.prevUsers} בחודש הקודם, אבל ${purchase.users} קנו לעומת ${purchase.prevUsers}. התנועה הנוספת לא איכותית.`,
      })
    }
  }
  return out
}
