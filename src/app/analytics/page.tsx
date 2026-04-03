'use client'

import { useEffect, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { StatCard } from '@/components/ui/StatCard'
import { OrderStatus, STATUS_CONFIG, ALL_STATUSES } from '@/types'

interface Stats { total: number; revenue: number; byStatus: Record<string, number> }

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/orders?pageSize=500')
      .then(r => r.json())
      .then(json => {
        const orders = json.data || []
        const byStatus: Record<string, number> = {}
        ALL_STATUSES.forEach(s => { byStatus[s] = 0 })
        orders.forEach((o: any) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1 })
        setStats({
          total:    json.count || 0,
          revenue:  orders.reduce((s: number, o: any) => s + (o.total_price || 0), 0),
          byStatus,
        })
      })
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <h1>אנליטיקס</h1>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="סה״כ הזמנות"   value={stats.total} />
            <StatCard label="הכנסות כולל"    value={formatPrice(stats.revenue)} valueClass="text-gold" />
            <StatCard label="ממוצע להזמנה"   value={stats.total ? formatPrice(stats.revenue / stats.total) : '—'} />
            <StatCard label="הזמנות שנשלחו"  value={stats.byStatus['shipped'] || 0} valueClass="text-blue-600" />
          </div>

          <div className="surface p-5">
            <div className="label mb-4">פירוט לפי סטטוס</div>
            <div className="flex flex-col gap-3">
              {ALL_STATUSES.map(s => {
                const n   = stats.byStatus[s] || 0
                const pct = stats.total ? Math.round((n / stats.total) * 100) : 0
                const cfg = STATUS_CONFIG[s]
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className={`badge ${cfg.bg} ${cfg.text} w-24 justify-center`}>
                      <span className={`badge-dot ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <div className="flex-1 bg-cream dark:bg-navy-deeper rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.dot.replace('bg-', 'bg-')}`}
                        style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-left ltr">{n}</span>
                    <span className="text-xs text-muted w-8 text-left ltr">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div className="surface p-10 text-center text-muted">
        <BarChart2 size={36} className="mx-auto mb-3 opacity-25" strokeWidth={1} />
        <p className="text-sm">גרפים מורחבים — Phase 3</p>
        <p className="text-xs mt-1 opacity-60">הכנסות לפי חודש, מוצרים פופולריים, פיזור גיאוגרפי</p>
      </div>
    </div>
  )
}
