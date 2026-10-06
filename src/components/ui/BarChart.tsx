import { cn } from '@/lib/utils'

// Simple vertical bar chart (CSS only). `revenue` values are labelled in ₪k.
export function BarChart({ data, valueKey, labelKey, color = 'bg-gold' }: {
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
