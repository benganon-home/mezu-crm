import { Order, OrderStatus, ITEM_COLOR_MAP } from '@/types'
import { formatDateShort, formatPrice, cn } from '@/lib/utils'
import { CopyButton } from '@/components/ui/CopyButton'
import { ItemStatusDropdown } from '@/components/orders/ItemStatusDropdown'
import { Truck, Home, Pin, ImageIcon } from 'lucide-react'

interface Props {
  order: Order
  selectedItemIds: Set<string>
  onToggleItem: (id: string, e: React.MouseEvent) => void
  onToggleOrderItems: (order: Order, e: React.MouseEvent) => void
  onItemStatusChange: (itemId: string, status: OrderStatus) => void
  onClick: () => void
}

export function OrderRow({ order, selectedItemIds, onToggleItem, onToggleOrderItems, onItemStatusChange, onClick }: Props) {
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
        <td onClick={e => onToggleOrderItems(order, e)}>
          <input
            type="checkbox"
            checked={allItemsSelected}
            ref={el => { if (el) el.indeterminate = someItemsSelected && !allItemsSelected }}
            onChange={() => {}}
            className="accent-gold"
          />
        </td>

        <td className="text-left">
          <div className="ltr text-xs text-muted tabular-nums">
            {formatDateShort(order.created_at)}
          </div>
          {order.is_pinned && <Pin size={10} className="text-gold mt-0.5" />}
        </td>

        <td>
          <div className="font-medium text-sm">{customer?.name}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="ltr text-xs text-muted">{customer?.phone}</span>
            <CopyButton text={customer?.phone || ''} />
          </div>
        </td>

        <td>
          <div className="text-xs text-muted max-w-[150px] truncate">
            {order.delivery_type === 'pickup'
              ? 'איסוף עצמי'
              : order.delivery_address || '—'
            }
          </div>
        </td>

        <td />

        <td>
          {order.delivery_type === 'delivery'
            ? <Truck size={14} className="text-muted" strokeWidth={1.5} />
            : <Home  size={14} className="text-muted" strokeWidth={1.5} />
          }
        </td>

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
                    'flex items-center gap-2.5 text-xs rounded-md px-2 py-1.5 -mx-2 transition-colors',
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

                  {/* Color circle + name */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: colorEntry?.hex ?? '#D1D5DB',
                        border: colorEntry?.border ? '1px solid #D1D5DB' : undefined,
                      }}
                    />
                    {item.color && (
                      <span className="text-muted whitespace-nowrap">{item.color}</span>
                    )}
                  </div>

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
                    <ItemStatusDropdown
                      itemId={item.id}
                      status={item.status}
                      onStatusChange={onItemStatusChange}
                    />
                    {item.price > 0 && (
                      <span className="ltr text-muted tabular-nums">
                        {formatPrice(item.price)}
                      </span>
                    )}
                  </div>

                  {/* Placeholder product image */}
                  <div className="w-10 h-10 rounded bg-cream-dark/40 dark:bg-navy-light/30 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={16} className="text-muted/50" strokeWidth={1.5} />
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
