'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { ITEM_COLOR_MAP } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (color: string) => void
  placeholder?: string
  className?: string
}

export function ColorPicker({ value, onChange, placeholder = 'צבע — ללא', className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = value ? ITEM_COLOR_MAP[value] : null

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input w-full flex items-center gap-2 cursor-pointer text-sm"
      >
        {selected ? (
          <>
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
              style={{ backgroundColor: selected.hex }}
            />
            <span className="flex-1 text-right">{value}</span>
          </>
        ) : (
          <span className="flex-1 text-right text-muted">{placeholder}</span>
        )}
        <ChevronDown size={12} className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-navy-dark border border-cream-dark dark:border-navy-light rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
          {/* No color option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-cream dark:hover:bg-navy-light/30 transition-colors text-right',
              !value && 'font-medium text-navy dark:text-cream'
            )}
          >
            <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 bg-cream-dark dark:bg-navy-light" />
            <span className="flex-1">{placeholder}</span>
          </button>

          {Object.entries(ITEM_COLOR_MAP).map(([name, { hex, border }]) => (
            <button
              key={name}
              type="button"
              onClick={() => { onChange(name); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-cream dark:hover:bg-navy-light/30 transition-colors text-right',
                value === name && 'font-medium text-navy dark:text-cream bg-cream/60 dark:bg-navy-light/20'
              )}
            >
              <span
                className={cn('w-3.5 h-3.5 rounded-full shrink-0', border && 'border border-black/15')}
                style={{ backgroundColor: hex }}
              />
              <span className="flex-1">{name}</span>
              {value === name && <span className="text-gold text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
