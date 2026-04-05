import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | number
  sub?: string
  valueClass?: string
  onClick?: () => void
  active?: boolean
}

export function StatCard({ label, value, sub, valueClass, onClick, active }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-navy-dark border rounded-lg px-4 py-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
        active
          ? 'border-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-800'
          : 'border-cream-dark dark:border-navy-light'
      )}
    >
      <div className="text-xs text-muted font-medium mb-1">{label}</div>
      <div className={cn('text-2xl font-semibold text-navy dark:text-cream leading-none', valueClass)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  )
}
