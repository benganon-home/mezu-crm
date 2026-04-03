'use client'

import { useState, useRef, useEffect } from 'react'
import { OrderStatus, ALL_STATUSES, STATUS_CONFIG } from '@/types'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface Props {
  itemId: string
  status: OrderStatus
  onStatusChange: (itemId: string, status: OrderStatus) => void
}

export function ItemStatusDropdown({ itemId, status, onStatusChange }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const handleSelect = async (newStatus: OrderStatus) => {
    if (newStatus === status) { setOpen(false); return }
    setOpen(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        onStatusChange(itemId, newStatus)
      }
    } finally {
      setSaving(false)
    }
  }

  const cfg = STATUS_CONFIG[status]

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={cn(
          'badge cursor-pointer transition-opacity',
          cfg.bg, cfg.text,
          'text-[10px] px-2 py-0.5',
          saving && 'opacity-50'
        )}
        disabled={saving}
      >
        {saving
          ? <Loader2 size={10} className="animate-spin" />
          : <span className={cn('badge-dot', cfg.dot)} />
        }
        {cfg.label}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 right-0 bg-white dark:bg-navy-dark border border-cream-dark dark:border-navy-light rounded-lg shadow-lg py-1 min-w-[120px]">
          {ALL_STATUSES.map(s => {
            const c = STATUS_CONFIG[s]
            return (
              <button
                key={s}
                type="button"
                onClick={e => { e.stopPropagation(); handleSelect(s) }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-right transition-colors',
                  'hover:bg-cream/60 dark:hover:bg-navy-light/40',
                  s === status && 'font-semibold'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', c.dot)} />
                <span className={c.text}>{c.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
