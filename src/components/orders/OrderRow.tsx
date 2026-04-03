import { Order } from '@/types'
import { formatDateShort, formatPrice, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import { Truck, Home, Pin, Package } from 'lucide-react'

interface Props {
  order: Order
  selected: boolean
  onToggle: (id: string, e: React.MouseEvent) => void
  onClick: () => void
}

export function OrderRow({ order, selected, onToggle, onClick }: Props) {
  const customer = order.customer
  const items    = order.items || []

  return (
    <>
      {/* ── Header row ── */}
      <tr
        className={cn('order-header-row', selected && 'selected', order.is_pinned && 'bg-gold/5')}
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

        {/* Date */}
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

      {/* ── Items sub-row ── */}
      <tr className="order-items-row" onClick={onClick}>
        <td colSpan={7} className="!pt-0 !pb-3 !pr-12">
          <div className="flex flex-col gap-1">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2.5 text-xs">
                <div className="w-7 h-7 rounded bg-cream-dark/60 dark:bg-navy-light/40 flex items-center justify-center flex-shrink-0">
                  <Package size={13} className="text-muted" strokeWidth={1.5} />
                </div>

                <span className="font-medium text-navy dark:text-cream/90">{item.item_name}</span>

                {item.color && (
                  <span className="text-muted">
                    {item.color}
                  </span>
                )}

                {item.sign_text && (
                  <span className="text-gold font-medium">
                    ״{item.sign_text}״
                  </span>
                )}

                {item.size && (
                  <span className="text-muted">
                    {item.size}
                  </span>
                )}

                {item.price > 0 && (
                  <span className="ltr text-muted tabular-nums mr-auto">
                    {formatPrice(item.price)}
                  </span>
                )}
              </div>
            ))}

            {items.length === 0 && (
              <span className="text-xs text-muted/60">—</span>
            )}
          </div>
        </td>
      </tr>
    </>
  )
}
