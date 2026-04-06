import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | number
  sub?: string
  valueClass?: string
  onClick?: () => void
  active?: boolean
  showFilter?: boolean
}

export function StatCard({ label, value, sub, valueClass, onClick, active, showFilter }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-navy-dark border rounded-lg px-4 py-3 transition-all flex flex-col',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
        active
          ? 'border-gold ring-2 ring-gold/20 dark:ring-gold/30'
          : 'border-cream-dark dark:border-navy-light'
      )}
    >
      <div className="text-xs text-muted font-medium mb-1">{label}</div>
      <div className={cn('text-2xl font-semibold text-navy dark:text-cream leading-none', valueClass)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      {showFilter && (
        <div className={cn(
          'text-xs mt-2 font-medium transition-colors',
          active ? 'text-gold' : 'text-muted hover:text-gold'
        )}>
          {active ? 'מסונן ✓' : 'הצג'}
        </div>
      )}
    </div>
  )
}
