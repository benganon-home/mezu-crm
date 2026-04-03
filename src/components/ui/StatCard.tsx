import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | number
  sub?: string
  valueClass?: string
}

export function StatCard({ label, value, sub, valueClass }: Props) {
  return (
    <div className="bg-white dark:bg-navy-dark border border-cream-dark dark:border-navy-light rounded-lg px-4 py-3">
      <div className="text-xs text-muted font-medium mb-1">{label}</div>
      <div className={cn('text-2xl font-semibold text-navy dark:text-cream leading-none', valueClass)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  )
}
