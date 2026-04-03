import { Order, ITEM_COLOR_MAP } from '@/types'
import { formatDateShort, formatPrice, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import { Truck, Home, Pin } from 'lucide-react'

interface Props {
  order: Order
  selectedItemIds: Set<string>
  onToggleItem: (id: string, e: React.MouseEvent) => void
  onToggleOrderItems: (order: Order, e: React.MouseEvent) => void
  onClick: () => void
}

export function OrderRow({ order, selectedItemIds, onToggleItem, onToggleOrderItems, onClick }: Props) {
  const customer = order.customer
  const items    = order.items || []
  const allItemsSelected = items.length > 0 && items.every(i => selectedItemIds.has(i.id))
  const someItemsSelected = items.some(i => selectedItemIds.has(i.id))

  return (
    <>
      {/* ── Header row ── */}
      <tr
        className={cn('order-header-row', someItemsSelected && 'selected', order.is_pinned && 'bg-gold/5')}
        onClick={onClick}
      >
        {/* Checkbox — toggles all items in this order */}
        <td onClick={e => onToggleOrderItems(order, e)}>
          <input
            type="checkbox"
            checked={allItemsSelected}
            ref={el => { if (el) el.indeterminate = someItemsSelected && !allItemsSelected }}
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

        {/* Status — empty in header, statuses live per-item */}
        <td />

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
        <td colSpan={7} className="!pt-0 !pb-3 !pr-6">
          <div className="flex flex-col gap-1.5">
            {items.map(item => {
              const colorEntry = item.color ? ITEM_COLOR_MAP[item.color] : null
              const isSelected = selectedItemIds.has(item.id)

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2.5 text-xs rounded-md px-2 py-1 -mx-2 transition-colors',
                    isSelected && 'bg-gold/8'
                  )}
                >
                  {/* Per-item checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={e => onToggleItem(item.id, e)}
                    className="accent-gold flex-shrink-0"
                  />

                  {/* Color circle */}
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: colorEntry?.hex ?? '#D1D5DB',
                      border: colorEntry?.border ? '1px solid #D1D5DB' : undefined,
                    }}
                    title={item.color || ''}
                  />

                  <span className="font-medium text-navy dark:text-cream/90">{item.item_name}</span>

                  {item.sign_text && (
                    <span className="text-gold font-medium">
                      ״{item.sign_text}״
                    </span>
                  )}

                  {item.size && (
                    <span className="text-muted">{item.size}</span>
                  )}

                  <div className="mr-auto flex items-center gap-2.5">
                    <StatusBadge status={item.status} size="sm" />
                    {item.price > 0 && (
                      <span className="ltr text-muted tabular-nums">
                        {formatPrice(item.price)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {items.length === 0 && (
              <span className="text-xs text-muted/60">—</span>
            )}
          </div>
        </td>
      </tr>
    </>
  )
}
