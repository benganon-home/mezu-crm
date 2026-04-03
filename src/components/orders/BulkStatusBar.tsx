'use client'

import { OrderStatus, ALL_STATUSES, STATUS_CONFIG } from '@/types'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  count: number
  onApply: (status: OrderStatus) => void
  onClear: () => void
}

export function BulkStatusBar({ count, onApply, onClear }: Props) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 z-30',
        'right-0 md:right-[var(--app-sidebar-width)]',
        'bg-white border-t border-cream-dark shadow-[0_-6px_24px_rgba(45,43,85,0.08)]',
        'px-4 py-3 md:px-6 flex items-center gap-3 flex-wrap text-sm',
        'dark:bg-white dark:border-cream-dark'
      )}
    >
      <span className="font-semibold text-navy tabular-nums">{count} נבחרו</span>
      <span className="text-cream-dark select-none">|</span>
      <span className="text-muted text-xs">שנה סטטוס ל:</span>

      <div className="flex gap-1.5 flex-wrap">
        {ALL_STATUSES.filter(s => s !== 'cancelled').map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onApply(s)}
            className={cn(
              'badge cursor-pointer transition-opacity hover:opacity-100 opacity-90',
              STATUS_CONFIG[s].bg,
              STATUS_CONFIG[s].text,
            )}
          >
            <span className={cn('badge-dot', STATUS_CONFIG[s].dot)} />
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onClear}
        className="mr-auto text-muted hover:text-navy p-1 rounded-md hover:bg-cream-dark/40 transition-colors"
        aria-label="בטל בחירה"
      >
        <X size={16} />
      </button>
    </div>
  )
}
