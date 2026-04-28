'use client'

import { useEffect, useRef, useState } from 'react'
import { Palette, Plus, Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react'
import type { ProductColor } from '@/types'
import { cn } from '@/lib/utils'
import { dottedStyle } from '@/lib/colorPattern'

// Simple HEX validator
const hexRe = /^#[0-9A-Fa-f]{6}$/

export function ProductColorsSection() {
  const [colors, setColors] = useState<ProductColor[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  // New color form
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex]   = useState('#CCCCCC')
  const [newBorder, setNewBorder] = useState(false)
  const [newDots, setNewDots]     = useState(false)

  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/product-colors')
    const data = await res.json()
    setColors(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const addColor = async () => {
    if (!newName.trim() || !hexRe.test(newHex)) {
      setError('שם וצבע HEX תקין חובה (לדוגמה: #A88B5C)')
      return
    }
    setAdding(true)
    setError(null)
    const maxOrder = colors.reduce((m, c) => Math.max(m, c.display_order || 0), 0)
    const res = await fetch('/api/product-colors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name_he:       newName.trim(),
        hex:           newHex.toUpperCase(),
        has_border:    newBorder,
        has_dots:      newDots,
        display_order: maxOrder + 1,
        is_active:     true,
      }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setError(data.error || 'שגיאה'); return }
    setNewName('')
    setNewHex('#CCCCCC')
    setNewBorder(false)
    setNewDots(false)
    load()
  }

  const updateColor = async (id: string, patch: Partial<ProductColor>) => {
    // Optimistic
    setColors(prev => prev.map(c => c.id === id ? { ...c, ...patch } as ProductColor : c))
    await fetch(`/api/product-colors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  const removeColor = async (id: string) => {
    if (!confirm('למחוק את הצבע?')) return
    setColors(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/product-colors/${id}`, { method: 'DELETE' })
  }

  // Move a color one step earlier (up) or later (down) in the visual order.
  // The list shown to customers in the store reads right-to-left top-to-bottom,
  // so "up" here = earlier (rightmost on the storefront).
  const moveColor = async (id: string, dir: -1 | 1) => {
    const i = colors.findIndex(c => c.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= colors.length) return

    const next = [...colors]
    ;[next[i], next[j]] = [next[j], next[i]]
    // Re-derive display_order from the new array index so values stay 0..N-1
    next.forEach((c, idx) => { c.display_order = idx })
    setColors(next)

    // Persist both swapped rows. If they had identical display_order before,
    // resetting via index removes any prior collisions for free.
    await Promise.all([
      fetch(`/api/product-colors/${next[i].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: i }),
      }),
      fetch(`/api/product-colors/${next[j].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: j }),
      }),
    ])
  }

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <Palette size={16} className="text-gold" strokeWidth={1.5} />
        <h3>צבעי מוצרים</h3>
      </div>
      <p className="text-xs text-muted mb-5">
        הצבעים שיוצעו ללקוחות בעמוד כל מוצר באתר. הזינו קוד צבע HEX (למשל <span className="ltr">#61615F</span>).
        סמנו {'"'}עם מסגרת{'"'} לצבעים בהירים כמו לבן או בז׳ כדי שהעיגול ייראה ברור.
        צבע שסימנתם כ{'"'}אזל{'"'} לא יוצג באתר.
        סדר התצוגה ניתן לשינוי באמצעות החיצים — הצבע הראשון ברשימה יוצג ראשון מימין באתר.
      </p>

      {/* List */}
      {loading ? (
        <div className="text-sm text-muted">טוען...</div>
      ) : (
        <div className="flex flex-col gap-2 mb-5">
          {colors.map((c, i) => (
            <ColorRow
              key={c.id}
              color={c}
              isFirst={i === 0}
              isLast={i === colors.length - 1}
              onUpdate={patch => updateColor(c.id, patch)}
              onDelete={() => removeColor(c.id)}
              onMoveUp={() => moveColor(c.id, -1)}
              onMoveDown={() => moveColor(c.id, 1)}
            />
          ))}
          {colors.length === 0 && (
            <div className="text-sm text-muted text-center py-6">אין צבעים — הוסף את הראשון למטה</div>
          )}
        </div>
      )}

      {/* Add new */}
      <div className="border-t border-cream-dark dark:border-navy-light pt-4">
        <div className="label mb-2">צבע חדש</div>
        <div className="grid grid-cols-[auto_1fr_120px_auto] gap-2 items-center">
          <HexPicker value={newHex} onChange={setNewHex} border={newBorder} dots={newDots} />
          <input
            className="input text-sm"
            placeholder="שם בעברית"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addColor()}
          />
          <input
            className="input text-sm ltr text-right font-mono uppercase"
            placeholder="#A88B5C"
            value={newHex}
            onChange={e => setNewHex(e.target.value)}
            dir="ltr"
          />
          <button
            onClick={addColor}
            disabled={adding || !newName.trim() || !hexRe.test(newHex)}
            className="w-9 h-9 flex items-center justify-center bg-gold text-white rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="flex items-center gap-5 flex-wrap mt-3">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={newBorder}
              onChange={e => setNewBorder(e.target.checked)}
              className="rounded accent-gold"
            />
            עם מסגרת (לצבעים בהירים)
          </label>
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={newDots}
              onChange={e => setNewDots(e.target.checked)}
              className="rounded accent-gold"
            />
            מנומר (אפקט שיש)
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 mt-3">
            <AlertTriangle size={12} /> {error}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Single color row ──────────────────────────────────────────

function ColorRow({
  color, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  color:      ProductColor
  isFirst:    boolean
  isLast:     boolean
  onUpdate:   (patch: Partial<ProductColor>) => void
  onDelete:   () => void
  onMoveUp:   () => void
  onMoveDown: () => void
}) {
  const [name, setName] = useState(color.name_he)
  const [hex, setHex]   = useState(color.hex)
  const [border, setBorder] = useState(color.has_border)
  const [dots, setDots]     = useState(!!color.has_dots)
  const [active, setActive] = useState(color.is_active !== false)

  // Debounce save
  const timer = useRef<NodeJS.Timeout | null>(null)
  const schedule = (patch: Partial<ProductColor>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onUpdate(patch), 400)
  }

  return (
    <div className={cn(
      'grid grid-cols-[auto_auto_1fr_120px_auto_auto_auto_auto] gap-2 items-center bg-cream/40 dark:bg-navy-deeper/50 rounded-xl px-2 py-1.5 transition-opacity',
      !active && 'opacity-55'
    )}>
      {/* Reorder arrows */}
      <div className="flex flex-col -gap-px">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          title="העבר למעלה"
          className="w-5 h-4 flex items-center justify-center text-muted hover:text-gold disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          title="העבר למטה"
          className="w-5 h-4 flex items-center justify-center text-muted hover:text-gold disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown size={12} />
        </button>
      </div>
      <HexPicker
        value={hex}
        onChange={h => { setHex(h); schedule({ hex: h.toUpperCase() }) }}
        border={border}
        dots={dots}
      />
      <input
        className="input text-sm border-transparent bg-transparent focus:border-gold"
        value={name}
        onChange={e => { setName(e.target.value); schedule({ name_he: e.target.value }) }}
      />
      <input
        className="input text-sm ltr text-right font-mono uppercase border-transparent bg-transparent focus:border-gold"
        value={hex}
        onChange={e => { setHex(e.target.value); if (hexRe.test(e.target.value)) schedule({ hex: e.target.value.toUpperCase() }) }}
        dir="ltr"
      />
      <label className="flex items-center gap-1 text-[10px] text-muted whitespace-nowrap cursor-pointer px-1">
        <input
          type="checkbox"
          checked={border}
          onChange={e => { setBorder(e.target.checked); onUpdate({ has_border: e.target.checked }) }}
          className="accent-gold"
        />
        מסגרת
      </label>
      <label className="flex items-center gap-1 text-[10px] text-muted whitespace-nowrap cursor-pointer px-1" title="מציג ניקודים עדינים על הצבע — לשיש או חומר מנומר">
        <input
          type="checkbox"
          checked={dots}
          onChange={e => { setDots(e.target.checked); onUpdate({ has_dots: e.target.checked }) }}
          className="accent-gold"
        />
        מנומר
      </label>
      <button
        onClick={() => { const next = !active; setActive(next); onUpdate({ is_active: next }) }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors',
          active
            ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-cream-dark/50 text-muted hover:bg-cream-dark dark:bg-navy-light dark:text-muted'
        )}
        title={active ? 'במלאי — מוצג באתר' : 'אזל — לא מוצג באתר'}
      >
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          active ? 'bg-green-500' : 'bg-muted/50'
        )} />
        {active ? 'זמין' : 'אזל'}
      </button>
      <button
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── Combined color preview + native picker ─────────────────────

function HexPicker({ value, onChange, border, dots }: { value: string; onChange: (v: string) => void; border?: boolean; dots?: boolean }) {
  const safe = hexRe.test(value) ? value : '#DDDDDD'
  return (
    <label
      className={cn(
        'relative h-9 w-9 rounded-full cursor-pointer block overflow-hidden',
        border ? 'border border-cream-dark dark:border-navy-light' : ''
      )}
      style={dottedStyle(safe, !!dots)}
    >
      <input
        type="color"
        value={hexRe.test(value) ? value : '#cccccc'}
        onChange={e => onChange(e.target.value.toUpperCase())}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        aria-label="בחר צבע"
      />
    </label>
  )
}
