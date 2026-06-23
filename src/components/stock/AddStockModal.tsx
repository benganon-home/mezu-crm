'use client'

import { useMemo, useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import type { Product } from '@/types'
import { ITEM_COLOR_MAP } from '@/types'

export function AddStockModal({
  products,
  onClose,
  onAdded,
}: {
  products: Product[]
  onClose: () => void
  onAdded: () => void
}) {
  const [productId, setProductId] = useState('')
  const [size, setSize]   = useState('')
  const [color, setColor] = useState('')
  const [qty, setQty]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const product = useMemo(() => products.find(p => p.id === productId) ?? null, [products, productId])
  const sizes  = (product?.sizes ?? []) as { label: string; price: number }[]
  const colors = (product?.colors ?? []) as string[]

  function selectProduct(id: string) {
    setProductId(id)
    const p = products.find(x => x.id === id)
    setSize(p?.sizes?.[0]?.label ?? '')
    setColor(p?.colors?.[0] ?? '')
  }

  async function submit() {
    if (!product) { setError('בחרו מוצר'); return }
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
      <div className="surface relative w-full max-w-md p-5" dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">הוספת מוצר מוכן</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">מוצר</label>
            <select value={productId} onChange={e => selectProduct(e.target.value)} className="input mt-1 w-full">
              <option value="">בחרו מוצר…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.category ? ` · ${p.category}` : ''}</option>
              ))}
            </select>
          </div>

          {sizes.length > 0 && (
            <div>
              <label className="label">מידה</label>
              <select value={size} onChange={e => setSize(e.target.value)} className="input mt-1 w-full">
                {sizes.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>
          )}

          {colors.length > 0 && (
            <div>
              <label className="label">צבע</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {colors.map(c => {
                  const sw = ITEM_COLOR_MAP[c]
                  const active = color === c
                  return (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                        active ? 'border-gold bg-gold/10 text-gold' : 'border-line hover:border-gold/50'
                      }`}
                    >
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: sw?.hex || '#ccc', boxShadow: sw?.border ? 'inset 0 0 0 1px #d4d4d4' : undefined }} />
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <label className="label">כמות</label>
            <div className="mt-1 flex items-center gap-2">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="grid h-9 w-9 place-items-center rounded-md border border-line hover:border-gold"><Minus size={15} /></button>
              <span className="w-12 text-center text-lg font-semibold tabular-nums">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="grid h-9 w-9 place-items-center rounded-md border border-line hover:border-gold"><Plus size={15} /></button>
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <button onClick={submit} disabled={saving || !productId} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'מוסיף…' : 'הוספה למלאי'}
          </button>
        </div>
      </div>
    </div>
  )
}
