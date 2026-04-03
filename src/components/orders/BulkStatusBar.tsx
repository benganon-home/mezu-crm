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
    <div className="flex items-center gap-3 bg-navy text-cream rounded-lg px-4 py-2.5 text-sm">
      <span className="text-gold font-medium">{count} נבחרו</span>
      <span className="text-cream/30">|</span>
      <span className="text-cream/60 text-xs">שנה סטטוס ל:</span>

      <div className="flex gap-1.5 flex-wrap">
        {ALL_STATUSES.filter(s => s !== 'cancelled').map(s => (
          <button
            key={s}
            onClick={() => onApply(s)}
            className={cn(
              'badge cursor-pointer transition-opacity hover:opacity-100 opacity-80',
              STATUS_CONFIG[s].bg,
              STATUS_CONFIG[s].text,
            )}
          >
            <span className={cn('badge-dot', STATUS_CONFIG[s].dot)} />
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      <button onClick={onClear} className="mr-auto text-cream/50 hover:text-cream">
        <X size={14} />
      </button>
    </div>
  )
}
