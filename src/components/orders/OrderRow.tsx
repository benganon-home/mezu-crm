import { Order } from '@/types'
import { formatDateShort, formatPrice, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import { Truck, Home, Pin } from 'lucide-react'

interface Props {
  order: Order
  selected: boolean
  onToggle: (id: string, e: React.MouseEvent) => void
  onClick: () => void
}

export function OrderRow({ order, selected, onToggle, onClick }: Props) {
  const customer  = order.customer
  const items     = order.items || []
  const itemNames = [...new Set(items.map(i => i.item_name.split('-')[0].trim()))].join(' · ')
  const hasSigns  = items.some(i => i.sign_text)

  return (
    <tr
      className={cn(selected && 'selected', order.is_pinned && 'bg-gold/5')}
      onClick={onClick}
    >
      {/* Checkbox */}
      <td onClick={e => onToggle(order.id, e)}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {}}
          className="accent-gold"
        />
      </td>

      {/* Date — leftmost */}
      <td className="text-left">
        <div className="ltr text-xs text-muted tabular-nums">
          {formatDateShort(order.created_at)}
        </div>
        {order.is_pinned && <Pin size={10} className="text-gold mt-0.5" />}
      </td>

      {/* Customer */}
      <td>
        <div className="font-medium text-sm">{customer?.name}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="ltr text-xs text-muted">{customer?.phone}</span>
          <CopyButton text={customer?.phone || ''} />
        </div>
      </td>

      {/* Items */}
      <td>
        <div className="text-sm">
          {itemNames}
          {items.length > 1 && (
            <span className="text-muted text-xs mr-1">({items.length})</span>
          )}
        </div>
        {hasSigns && (
          <div className="text-xs text-gold mt-0.5">
            {items.filter(i => i.sign_text).map(i => i.sign_text).join(' · ')}
          </div>
        )}
      </td>

      {/* Address */}
      <td>
        <div className="text-xs text-muted max-w-[150px] truncate">
          {order.delivery_type === 'pickup'
            ? 'איסוף עצמי'
            : order.delivery_address || '—'
          }
        </div>
      </td>

      {/* Status */}
      <td><StatusBadge status={order.status} /></td>

      {/* Delivery icon */}
      <td>
        {order.delivery_type === 'delivery'
          ? <Truck size={14} className="text-muted" strokeWidth={1.5} />
          : <Home  size={14} className="text-muted" strokeWidth={1.5} />
        }
      </td>

      {/* Price */}
      <td className="text-left">
        <span className="ltr font-medium text-sm tabular-nums">
          {formatPrice(order.total_price)}
        </span>
      </td>
    </tr>
  )
}
