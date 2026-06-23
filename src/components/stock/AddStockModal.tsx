'use client'

import { useMemo, useState } from 'react'
import { X, Plus, Minus, Package, Check } from 'lucide-react'
import type { Product } from '@/types'
import { cn } from '@/lib/utils'
import { dottedStyle } from '@/lib/colorPattern'
import { useProductColors, resolveColor } from '@/lib/productColors'

export function AddStockModal({
  products,
  onClose,
  onAdded,
}: {
  products: Product[]
  onClose: () => void
  onAdded: () => void
}) {
  const allColors = useProductColors()
  const [productId, setProductId] = useState('')
  const [size, setSize]   = useState('')
  const [color, setColor] = useState('')
  const [qty, setQty]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const product = useMemo(() => products.find(p => p.id === productId) ?? null, [products, productId])
  const sizes  = (product?.sizes ?? []) as { label: string; price: number }[]

  // Colors the product comes in (resolved against the global palette for the
  // correct hex/pattern). Falls back to the full palette if the product has
  // no colors set — so a color can always be chosen to match an order exactly.
  const colorOptions = useMemo(() => {
    const names = (product?.colors ?? []) as string[]
    const list = names.length
      ? names.map(n => resolveColor(n, allColors) ?? { name_he: n, hex: '#CCCCCC', has_border: false, has_dots: false })
      : allColors
    return list
  }, [product, allColors])

  function selectProduct(p: Product) {
    setProductId(p.id)
    setSize(p.sizes?.[0]?.label ?? '')
    const firstColor = (p.colors?.length ? p.colors[0] : allColors[0]?.name_he) ?? ''
    setColor(firstColor)
    setError(null)
  }

  const canSubmit = !!product && !!color && (sizes.length === 0 || !!size)

  async function submit() {
    if (!product) { setError('בחרו מוצר'); return }
    if (!color)   { setError('בחרו צבע — כדי שיתאים להזמנה'); return }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: product.id,
        item_name:  product.name,
        category:   product.category || 'אחר',
        size:  size  || null,
        color: color || null,
        quantity: qty,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'שגיאה בהוספה')
      return
    }
    onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="surface relative flex max-h-[85vh] w-full max-w-2xl flex-col p-5" dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">הוספת מוצר מוכן</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* Product grid */}
          <div>
            <label className="label">מוצר</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {products.map(p => {
                const active = p.id === productId
                const img = p.images?.[0]
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={cn(
                      'group flex flex-col overflow-hidden rounded-xl border text-right transition',
                      active ? 'border-gold ring-1 ring-gold' : 'border-line hover:border-gold/50',
                    )}
                  >
                    <div className="relative aspect-square w-full bg-cream/60 dark:bg-navy-light/20">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted">
                          <Package size={22} strokeWidth={1.5} />
                        </div>
                      )}
                      {active && (
                        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-white">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-xs font-medium">{p.name}</div>
                      {p.category && <div className="truncate text-[10px] text-muted">{p.category}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {product && (
            <>
              {/* Size */}
              {sizes.length > 0 && (
                <div>
                  <label className="label">מידה</label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {sizes.map(s => (
                      <button
                        key={s.label}
                        onClick={() => setSize(s.label)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                          size === s.label ? 'border-gold bg-gold/10 text-gold' : 'border-line hover:border-gold/50',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Color — required so the stock fits an order exactly */}
              <div>
                <label className="label">צבע <span className="text-gold">*</span></label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {colorOptions.map(c => {
                    const active = color === c.name_he
                    return (
                      <button
                        key={c.name_he}
                        onClick={() => setColor(c.name_he)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition',
                          active ? 'border-gold bg-gold/10 text-gold' : 'border-line hover:border-gold/50',
                        )}
                      >
                        <span
                          className={cn('h-3.5 w-3.5 rounded-full', c.has_border ? 'border border-black/15' : 'border border-black/10')}
                          style={dottedStyle(c.hex, c.has_dots)}
                        />
                        {c.name_he}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="label">כמות</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="grid h-9 w-9 place-items-center rounded-md border border-line hover:border-gold"><Minus size={15} /></button>
                  <span className="w-12 text-center text-lg font-semibold tabular-nums">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="grid h-9 w-9 place-items-center rounded-md border border-line hover:border-gold"><Plus size={15} /></button>
                </div>
              </div>
            </>
          )}

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        </div>

        <button onClick={submit} disabled={saving || !canSubmit} className="btn-primary mt-4 w-full disabled:opacity-50">
          {saving ? 'מוסיף…' : 'הוספה למלאי'}
        </button>
      </div>
    </div>
  )
}
