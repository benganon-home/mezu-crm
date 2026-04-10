import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | number
  sub?: string
  valueClass?: string
  onClick?: () => void
  active?: boolean
  showFilter?: boolean
  actionLabel?: string
  onAction?: (e: React.MouseEvent) => void
}

export function StatCard({ label, value, sub, valueClass, onClick, active, showFilter, actionLabel, onAction }: Props) {
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
      {(showFilter || actionLabel) && (
        <div className="flex items-center justify-between mt-2">
          {actionLabel && onAction ? (
            <button
              onClick={onAction}
              className="text-xs font-medium text-muted hover:text-emerald-600 transition-colors border border-cream-dark dark:border-navy-light rounded px-2 py-0.5 hover:border-emerald-300"
            >
              {actionLabel}
            </button>
          ) : <span />}
          {showFilter && (
            <div className={cn(
              'text-xs font-medium transition-colors',
              active ? 'text-gold' : 'text-muted hover:text-gold'
            )}>
              {active ? 'מסונן ✓' : 'הצג'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
