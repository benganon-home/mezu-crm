import { OrderStatus, STATUS_CONFIG } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  status: OrderStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn(
      'badge',
      cfg.bg, cfg.text, `border-[${cfg.border}]`,
      size === 'sm' && 'text-[10px] px-2 py-0.5'
    )}>
      <span className={cn('badge-dot', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
