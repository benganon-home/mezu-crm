import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { gaConfigured, runReport } from '@/lib/ga'
import { FUNNEL_STEPS, buildFunnel, buildSources, buildSiteActions } from '@/lib/marketing-ga'

export const dynamic = 'force-dynamic'

// GET /api/marketing/site — GA4 funnel (30d vs prior 30d) + traffic sources.
// Separate from /api/marketing so a GA outage never blanks the checkout data.
export async function GET() {
  const { data: { user } } = await createServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!gaConfigured()) return NextResponse.json({ error: 'GA לא מוגדר' }, { status: 503 })

  try {
    const [funnelRows, sourceRows] = await Promise.all([
      runReport({
        dateRanges: [
          { startDate: '30daysAgo', endDate: 'yesterday', name: 'cur' },
          { startDate: '60daysAgo', endDate: '31daysAgo', name: 'prev' },
        ],
        dimensions: [{ name: 'eventName' }],
        metrics:    [{ name: 'totalUsers' }],
        dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: FUNNEL_STEPS.map(s => s.event) } } },
      }),
      runReport({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics:    [{ name: 'sessions' }, { name: 'addToCarts' }, { name: 'ecommercePurchases' }, { name: 'purchaseRevenue' }],
      }),
    ])
    const funnel  = buildFunnel(funnelRows)
    const sources = buildSources(sourceRows)
    return NextResponse.json({ funnel, sources, actions: buildSiteActions(funnel, sources) })
  } catch (err) {
    console.error('[marketing/site] GA failed', err)
    return NextResponse.json({ error: 'שגיאה בטעינת נתוני גוגל אנליטיקס' }, { status: 502 })
  }
}
