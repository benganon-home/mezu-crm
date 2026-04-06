import { Order, OrderStatus, ITEM_COLOR_MAP } from '@/types'
import { formatDateShort, formatPrice, cn } from '@/lib/utils'
import { CopyButton } from '@/components/ui/CopyButton'
import { ItemStatusDropdown } from '@/components/orders/ItemStatusDropdown'
import { Truck, Home, Pin, ImageIcon, CheckCircle2, StickyNote } from 'lucide-react'

interface Props {
  order: Order
  selectedItemIds: Set<string>
  onToggleItem: (id: string, e: React.MouseEvent) => void
  onToggleOrderItems: (order: Order, e: React.MouseEvent) => void
  onItemStatusChange: (itemId: string, status: OrderStatus) => void
  onClick: () => void
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0)
  return words[0].charAt(0) + words[words.length - 1].charAt(0)
}

export function OrderRow({ order, selectedItemIds, onToggleItem, onToggleOrderItems, onItemStatusChange, onClick }: Props) {
  const customer = order.customer
  const items    = order.items || []
  const allItemsSelected = items.length > 0 && items.every(i => selectedItemIds.has(i.id))
  const someItemsSelected = items.some(i => selectedItemIds.has(i.id))
  /** Fully done only when every line item is shipped — not just order-level status */
  const allItemsShipped =
    items.length > 0
      ? items.every(i => i.status === 'shipped')
      : order.status === 'shipped'

  return (
    <>
      {/* ── Header row ── */}
      <tr
        className={cn(
          'order-header-row',
          someItemsSelected && 'selected',
          order.is_pinned && 'bg-gold/5',
          allItemsShipped && 'opacity-50'
        )}
        onClick={onClick}
      >
        <td onClick={e => onToggleOrderItems(order, e)}>
          {allItemsShipped ? (
            <CheckCircle2 size={16} className="text-emerald-400" strokeWidth={2} />
          ) : (
            <input
              type="checkbox"
              checked={allItemsSelected}
              ref={el => { if (el) el.indeterminate = someItemsSelected && !allItemsSelected }}
              onChange={() => {}}
              className="accent-gold"
            />
          )}
        </td>

        <td>
          <div className="text-xs text-muted tabular-nums">
            {formatDateShort(order.created_at)}
          </div>
          {order.is_pinned && <Pin size={10} className="text-gold mt-0.5" />}
        </td>

        <td>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-navy/10 dark:bg-cream/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-navy dark:text-cream select-none">
              {getInitials(customer?.name || '')}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm">{customer?.name}</span>
                <CopyButton text={customer?.name || ''} />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="ltr text-xs text-muted">{customer?.phone}</span>
                <CopyButton text={customer?.phone || ''} />
              </div>
            </div>
          </div>
        </td>

        <td>
          <div className="text-xs text-muted">
            {order.delivery_type === 'pickup'
              ? 'איסוף עצמי'
              : order.delivery_address || '—'
            }
          </div>
        </td>

        <td>
          {order.notes && (
            <div className="relative group inline-flex" onClick={onClick}>
              <StickyNote size={14} className="text-gold cursor-pointer" strokeWidth={1.5} />
              <div className="pointer-events-none absolute bottom-full right-1/2 translate-x-1/2 mb-2 z-50
                              hidden group-hover:block
                              max-w-[220px] w-max rounded-lg bg-navy text-cream dark:bg-cream dark:text-navy
                              text-xs px-3 py-2 shadow-lg leading-relaxed whitespace-pre-wrap">
                {order.notes}
                <div className="absolute top-full right-1/2 translate-x-1/2 -mt-px
                                border-4 border-transparent border-t-navy dark:border-t-cream" />
              </div>
            </div>
          )}
        </td>

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
      <tr className={cn('order-items-row', allItemsShipped && 'opacity-50')}>
        <td colSpan={7} className="!pt-0 !pb-3 !pr-6">
          <div className="flex flex-col gap-0.5">
            {items.map(item => {
              const colorEntry = item.color ? ITEM_COLOR_MAP[item.color] : null
              const isSelected = selectedItemIds.has(item.id)

              return (
                <div
                  key={item.id}
                  onClick={e => onToggleItem(item.id, e)}
                  className={cn(
                    'flex items-center gap-3 text-xs rounded-lg px-2 py-2.5 -mx-2 transition-colors cursor-pointer',
                    'hover:bg-cream-dark dark:hover:bg-navy-light/30',
                    isSelected && 'bg-gold/10'
                  )}
                >
                  {/* Per-item checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="accent-gold flex-shrink-0 pointer-events-none"
                  />

                  {/* Placeholder product image */}
                  <div className="w-10 h-10 rounded-lg bg-cream-dark/50 dark:bg-navy-light/30 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={16} className="text-muted/40" strokeWidth={1.5} />
                  </div>

                  {/* Item name */}
                  <span className="font-medium text-navy dark:text-cream/90">{item.item_name}</span>

                  {/* Spacer */}
                  <span className="text-cream-dark dark:text-navy-light select-none">|</span>

                  {/* Color circle + name */}
                  {item.color && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 border border-black/15"
                        style={{ backgroundColor: colorEntry?.hex ?? '#C8C5D8' }}
                      />
                      <span className="text-muted whitespace-nowrap">{item.color}</span>
                    </div>
                  )}

                  {/* Spacer before sign text */}
                  {item.sign_text && (
                    <>
                      <span className="text-cream-dark dark:text-navy-light select-none">|</span>
                      <span className="text-gold font-medium">
                        ״{item.sign_text}״
                      </span>
                    </>
                  )}

                  {/* Font */}
                  {item.font && (
                    <>
                      <span className="text-cream-dark dark:text-navy-light select-none">|</span>
                      <span className="text-muted">{item.font}</span>
                    </>
                  )}

                  {/* Price */}
                  {item.price > 0 && (
                    <span className="ltr text-xs font-medium text-navy dark:text-cream/80 tabular-nums mr-auto shrink-0">
                      {formatPrice(item.price)}
                    </span>
                  )}

                  {/* Status dropdown */}
                  <div className={cn('shrink-0', !item.price && 'mr-auto')} onClick={e => e.stopPropagation()}>
                    <ItemStatusDropdown
                      itemId={item.id}
                      status={item.status}
                      onStatusChange={onItemStatusChange}
                    />
                  </div>
                </div>
              )
            })}

            {items.length === 0 && (
              <span className="text-xs text-muted/60 py-2">—</span>
            )}
          </div>
        </td>
      </tr>
    </>
  )
}
