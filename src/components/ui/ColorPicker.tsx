'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dottedStyle } from '@/lib/colorPattern'
import { useProductColors, resolveColor, type ColorOption } from '@/lib/productColors'

interface Props {
  value: string
  onChange: (color: string) => void
  placeholder?: string
  className?: string
}

export function ColorPicker({ value, onChange, placeholder = 'צבע — ללא', className }: Props) {
  const [open, setOpen] = useState(false)
  const colors = useProductColors()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = resolveColor(value, colors)
  const known = !!value && colors.some(c => c.name_he === value)

  // If the current value is a retired color missing from the active list,
  // append it so it still renders as selected.
  const options: ColorOption[] = [...colors]
  if (value && !known) {
    options.push(selected ?? { name_he: value, hex: '#CCCCCC', has_border: false, has_dots: false, is_active: false })
  }

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
              className={cn('w-3.5 h-3.5 rounded-full shrink-0', selected.has_border ? 'border border-black/15' : 'border border-black/10')}
              style={dottedStyle(selected.hex, selected.has_dots)}
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

          {options.map(({ name_he, hex, has_border, has_dots, is_active }) => (
            <button
              key={name_he}
              type="button"
              onClick={() => { onChange(name_he); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-cream dark:hover:bg-navy-light/30 transition-colors text-right',
                value === name_he && 'font-medium text-navy dark:text-cream bg-cream/60 dark:bg-navy-light/20'
              )}
            >
              <span
                className={cn('w-3.5 h-3.5 rounded-full shrink-0', has_border && 'border border-black/15')}
                style={dottedStyle(hex, has_dots)}
              />
              <span className="flex-1">{name_he}</span>
              {is_active === false && <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">אזל</span>}
              {value === name_he && <span className="text-gold text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
