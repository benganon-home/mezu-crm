import { useState, useRef } from 'react'
import { Order, OrderItem, OrderStatus, ITEM_COLOR_MAP } from '@/types'
import { formatDateShort, formatPrice, cn } from '@/lib/utils'
import { CopyButton } from '@/components/ui/CopyButton'
import { ItemStatusDropdown } from '@/components/orders/ItemStatusDropdown'
import { Truck, Home, Pin, StickyNote, Trash2, ImageIcon } from 'lucide-react'

interface Props {
  order: Order
  selectedItemIds: Set<string>
  onToggleItem: (id: string, e: React.MouseEvent) => void
  onItemStatusChange: (itemId: string, status: OrderStatus) => void
  onDeleteItem: (itemId: string, orderId: string, item: OrderItem) => void
  onClick: () => void
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0)
  return words[0].charAt(0) + words[words.length - 1].charAt(0)
}

export function OrderRow({ order, selectedItemIds, onToggleItem, onItemStatusChange, onDeleteItem, onClick }: Props) {
  const customer = order.customer
  const items    = order.items || []
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [previewImg, setPreviewImg]   = useState<{ src: string; x: number; y: number } | null>(null)

  const handleDeleteItem = (item: OrderItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(item.id)
    onDeleteItem(item.id, order.id, item)
    setDeletingId(null)
  }

  return (
    <>
    <div className="flex min-h-[80px] rounded-lg border border-cream-dark dark:border-navy-light/60 overflow-hidden bg-white dark:bg-navy-dark">

      {/* ── Right panel: order info ───────────────────────── */}
      <div
        onClick={onClick}
        className="w-[260px] shrink-0 px-4 py-4 border-l border-cream-dark dark:border-navy-light/60 cursor-pointer hover:bg-gold/5 dark:hover:bg-white/3 transition-colors flex flex-col gap-2.5"
      >
        {/* Date + pin */}
        <div className="flex items-center gap-1.5 text-xs text-muted tabular-nums">
          {formatDateShort(order.created_at)}
          {order.is_pinned && <Pin size={10} className="text-gold" />}
        </div>

        {/* Customer */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-navy/10 dark:bg-cream/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-navy dark:text-cream select-none">
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

        {/* Address + delivery type */}
        <div className="flex items-start gap-1.5 text-xs text-muted">
          {order.delivery_type === 'delivery'
            ? <Truck size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            : <Home  size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          }
          <span>{order.delivery_type === 'pickup' ? 'איסוף עצמי' : (order.delivery_address || '—')}</span>
        </div>

        {/* Total */}
        <div className="ltr text-sm font-semibold text-gold tabular-nums mt-auto">
          {formatPrice(items.reduce((s, i) => s + (i.price || 0), 0))}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="relative group flex items-center gap-1.5 cursor-default" onClick={e => e.stopPropagation()}>
            <StickyNote size={13} className="text-gold shrink-0" strokeWidth={1.5} />
            <span className="text-xs text-muted truncate">{order.notes.slice(0, 40)}{order.notes.length > 40 ? '…' : ''}</span>
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 z-50
                            hidden group-hover:block
                            max-w-[220px] w-max rounded-lg bg-navy text-cream dark:bg-cream dark:text-navy
                            text-xs px-3 py-2 shadow-lg leading-relaxed whitespace-pre-wrap">
              {order.notes}
              <div className="absolute top-full right-3 -mt-px border-4 border-transparent border-t-navy dark:border-t-cream" />
            </div>
          </div>
        )}
      </div>

      {/* ── Left panel: products ──────────────────────────── */}
      <div className="flex-1 min-w-0">
        {items.length === 0 && (
          <div className="px-4 py-4 text-xs text-muted/50">—</div>
        )}
        {items.map((item, idx) => {
          const colorEntry = item.color ? ITEM_COLOR_MAP[item.color] : null
          const isSelected = selectedItemIds.has(item.id)

          return (
            <div
              key={item.id}
              onClick={e => onToggleItem(item.id, e)}
              className={cn(
                'flex items-center gap-0 text-xs border-b border-cream-dark/50 dark:border-navy-light/20 last:border-b-0',
                'hover:bg-gold/5 dark:hover:bg-white/3 transition-colors cursor-pointer',
                isSelected && 'bg-gold/10 dark:bg-gold/10',
                idx === 0 && 'rounded-tr-lg'
              )}
            >
              {/* Checkbox */}
              <div className="px-3 py-3.5 shrink-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="accent-gold pointer-events-none"
                />
              </div>

              {/* Image */}
              <div className="w-[52px] shrink-0 px-2 py-2.5" onClick={e => e.stopPropagation()}>
                <div
                  className="w-9 h-9 rounded-lg bg-cream-dark/60 dark:bg-navy-light/30 flex items-center justify-center overflow-hidden cursor-zoom-in"
                  onMouseEnter={e => {
                    if (!item.product?.images?.[0]) return
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    setPreviewImg({ src: item.product.images[0], x: r.left, y: r.top })
                  }}
                  onMouseLeave={() => setPreviewImg(null)}
                >
                  {item.product?.images?.[0]
                    ? <img src={item.product.images[0]} alt={item.item_name} className="w-full h-full object-cover" />
                    : <ImageIcon size={15} className="text-muted/30" strokeWidth={1.5} />
                  }
                </div>
              </div>

              {/* פריטים */}
              <div className="flex-1 min-w-0 px-2 py-3.5">
                <div className="font-medium text-navy dark:text-cream/90 truncate">
                  {item.item_name}
                  {item.size && <span className="font-normal text-muted"> - {item.size} ס״מ</span>}
                  {item.model && <span className="font-normal text-muted"> | {item.model}</span>}
                </div>
              </div>

              {/* צבע */}
              <div className="w-[170px] shrink-0 px-2 py-3.5">
                {item.color ? (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15"
                      style={{ backgroundColor: colorEntry?.hex ?? '#C8C5D8' }}
                    />
                    <span className="text-muted truncate">{item.color}</span>
                  </div>
                ) : <span className="text-muted/40">—</span>}
              </div>

              {/* טקסט */}
              <div className="w-[120px] shrink-0 px-2 py-3.5 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {item.sign_text
                  ? <>
                      <span className="text-gold font-medium truncate">
                        {item.sign_text.includes('\n')
                          ? item.sign_text.replace('\n', '›')
                          : item.sign_text}
                      </span>
                      <CopyButton text={item.sign_text} />
                    </>
                  : <span className="text-muted/40 font-normal">—</span>
                }
              </div>

              {/* פונט */}
              <div className="w-[110px] shrink-0 px-2 py-3.5 text-muted truncate">
                {item.font || '—'}
              </div>

              {/* מחיר */}
              <div className="w-[70px] shrink-0 px-2 py-3.5 ltr font-medium tabular-nums">
                {item.price > 0 ? formatPrice(item.price) : '—'}
              </div>

              {/* סטטוס */}
              <div className="w-[110px] shrink-0 px-2 py-3.5" onClick={e => e.stopPropagation()}>
                <ItemStatusDropdown
                  itemId={item.id}
                  status={item.status}
                  onStatusChange={onItemStatusChange}
                />
              </div>

              {/* Delete */}
              <div className="px-3 py-3.5 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={e => handleDeleteItem(item, e)}
                  disabled={deletingId === item.id}
                  className="text-muted/40 hover:text-red-500 transition-colors disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>

      {/* Fixed image preview — escapes overflow:hidden */}
      {previewImg && (
        <div
          className="fixed z-[999] pointer-events-none"
          style={{ top: previewImg.y - 220, left: previewImg.x - 80 }}
        >
          <img
            src={previewImg.src}
            alt="תצוגה מקדימה"
            className="w-56 h-56 object-cover rounded-2xl shadow-2xl border-2 border-white dark:border-navy-light"
          />
        </div>
      )}
</>
  )
}
