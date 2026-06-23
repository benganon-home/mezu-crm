'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Minus, Trash2, Boxes } from 'lucide-react'
import type { Product, StockItem } from '@/types'
import { ITEM_COLOR_MAP } from '@/types'
import { AddStockModal } from '@/components/stock/AddStockModal'

const CATEGORY_ORDER = ['מזוזות', 'שלטי בית', 'ברכות', 'אחר']

export default function StockPage() {
  const [stock, setStock]       = useState<StockItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)

  const fetchStock = async () => {
    const res = await fetch('/api/stock')
    const d = await res.json()
    setStock(Array.isArray(d) ? d : [])
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/stock').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
    ]).then(([s, p]) => {
      setStock(Array.isArray(s) ? s : [])
      setProducts(Array.isArray(p) ? p.filter((x: Product) => x.is_active) : [])
      setLoading(false)
    })
  }, [])

  async function adjust(item: StockItem, delta: number) {
    const quantity = Math.max(0, item.quantity + delta)
    setStock(prev => prev.map(s => (s.id === item.id ? { ...s, quantity } : s)))
    await fetch(`/api/stock/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    })
  }

  async function remove(item: StockItem) {
    setStock(prev => prev.filter(s => s.id !== item.id))
    await fetch(`/api/stock/${item.id}`, { method: 'DELETE' })
  }

  const groups = useMemo(() => {
    const map = new Map<string, StockItem[]>()
    for (const s of stock) {
      const cat = s.category || 'אחר'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(s)
    }
    return [...map.entries()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a[0]); const ib = CATEGORY_ORDER.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [stock])

  const totalUnits = useMemo(() => stock.reduce((s, i) => s + i.quantity, 0), [stock])

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1>מלאי</h1>
          <p className="text-xs text-muted mt-0.5">
            {totalUnits} יחידות מוכנות{stock.length ? ` · ${stock.length} סוגים` : ''}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} strokeWidth={1.5} />
          הוספת מוצר מוכן
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted">טוען…</div>
      ) : stock.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Boxes size={28} className="text-muted" strokeWidth={1.5} />
          <p className="text-sm text-muted">אין מוצרים מוכנים במלאי</p>
          <button onClick={() => setShowAdd(true)} className="btn-secondary mt-1">הוספת מוצר מוכן</button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([cat, items]) => (
            <div key={cat} className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <h2 className="text-sm font-semibold">{cat}</h2>
                <span className="text-xs text-muted">{items.reduce((s, i) => s + i.quantity, 0)} יח׳</span>
              </div>
              <div className="divide-y divide-line">
                {items.map(item => (
                  <StockRow key={item.id} item={item} onAdjust={adjust} onRemove={remove} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddStockModal
          products={products}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchStock() }}
        />
      )}
    </div>
  )
}

function StockRow({
  item, onAdjust, onRemove,
}: {
  item: StockItem
  onAdjust: (i: StockItem, d: number) => void
  onRemove: (i: StockItem) => void
}) {
  const swatch = item.color ? ITEM_COLOR_MAP[item.color] : undefined
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.item_name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          {item.size && <span>{item.size} ס״מ</span>}
          {item.color && (
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full" style={{ background: swatch?.hex || '#ccc', boxShadow: swatch?.border ? 'inset 0 0 0 1px #d4d4d4' : undefined }} />
              {item.color}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onAdjust(item, -1)} disabled={item.quantity <= 0} className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:border-gold disabled:opacity-40"><Minus size={13} /></button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
        <button onClick={() => onAdjust(item, 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:border-gold"><Plus size={13} /></button>
      </div>
      <button onClick={() => onRemove(item)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:text-red-500" title="הסר"><Trash2 size={14} /></button>
    </div>
  )
}
