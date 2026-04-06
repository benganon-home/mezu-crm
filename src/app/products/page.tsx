'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Package, LayoutGrid, List } from 'lucide-react'
import { Product } from '@/types'
import { cn } from '@/lib/utils'
import { ProductCard } from '@/components/products/ProductCard'
import { ProductListRow } from '@/components/products/ProductListRow'
import { ProductDrawer } from '@/components/products/ProductDrawer'

const CATEGORIES = ['הכל', 'מזוזות', 'שלטי בית', 'מתנות', 'אחר']

export default function ProductsPage() {
  const [products, setProducts]         = useState<Product[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [category, setCategory]         = useState('הכל')
  const [showInactive, setShowInactive] = useState(false)
  const [view, setView]                 = useState<'grid' | 'list'>('grid')
  const [showDrawer, setShowDrawer]     = useState(false)
  const [editProduct, setEditProduct]   = useState<Product | null>(null)

  const fetchProducts = async () => {
    setLoading(true)
    const res = await fetch('/api/products')
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  const filtered = useMemo(() => {
    let result = products
    if (!showInactive) result = result.filter(p => p.is_active)
    if (category !== 'הכל') result = result.filter(p => p.category === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [products, category, search, showInactive])

  const onSave = (saved: Product) => {
    setProducts(prev => {
      const exists = prev.some(p => p.id === saved.id)
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]
    })
    setShowDrawer(false)
    setEditProduct(null)
  }

  const onDelete = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id))
    setShowDrawer(false)
    setEditProduct(null)
  }

  const onDuplicate = (cloned: Product) => {
    setProducts(prev => [cloned, ...prev])
  }

  const openNew  = () => { setEditProduct(null); setShowDrawer(true) }
  const openEdit = (p: Product) => { setEditProduct(p); setShowDrawer(true) }

  const duplicateProduct = async (p: Product) => {
    const payload = {
      name: `עותק של ${p.name}`,
      description: p.description,
      base_price: p.base_price,
      category: p.category,
      is_active: true,
      images: p.images,
      sizes: p.sizes,
      colors: p.colors,
    }
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const cloned = await res.json()
    if (res.ok) setProducts(prev => [cloned, ...prev])
  }

  const activeCount   = products.filter(p => p.is_active).length
  const inactiveCount = products.filter(p => !p.is_active).length

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>מוצרים</h1>
          <p className="text-xs text-muted mt-0.5">{activeCount} פעילים{inactiveCount > 0 ? ` · ${inactiveCount} לא פעילים` : ''}</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={14} strokeWidth={1.5} />
          מוצר חדש
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pr-9 w-full"
            placeholder="חיפוש מוצרים..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 items-center shrink-0">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={cn('chip-btn', category === c && 'chip-btn-active')}>{c}</button>
          ))}
          <button onClick={() => setShowInactive(v => !v)} className={cn('chip-btn', showInactive && 'chip-btn-active')}>לא פעילים</button>
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-cream-dark dark:border-navy-light rounded-lg overflow-hidden shrink-0">
          <button
            onClick={() => setView('grid')}
            className={cn('p-2 transition-colors', view === 'grid' ? 'bg-navy text-cream dark:bg-gold dark:text-navy' : 'text-muted hover:text-navy dark:hover:text-cream')}
            title="תצוגת קארדים"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('p-2 transition-colors', view === 'list' ? 'bg-navy text-cream dark:bg-gold dark:text-navy' : 'text-muted hover:text-navy dark:hover:text-cream')}
            title="תצוגת רשימה"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-16 text-muted text-sm">טוען מוצרים...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted">
          <Package size={36} strokeWidth={1} className="opacity-30" />
          <p className="text-sm">{products.length === 0 ? 'עוד אין מוצרים — הוסף את הראשון' : 'לא נמצאו מוצרים'}</p>
          {products.length === 0 && (
            <button onClick={openNew} className="btn-primary text-sm mt-1">
              <Plus size={13} className="inline ml-1" />
              הוסף מוצר ראשון
            </button>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => openEdit(p)}
              onDuplicate={e => { e.stopPropagation(); duplicateProduct(p) }}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && view === 'list' && (
        <div className="surface overflow-hidden">
          {/* List header */}
          <div className="flex items-center gap-4 px-4 py-2 border-b border-cream-dark dark:border-navy-light bg-cream dark:bg-navy-dark text-[11px] font-medium text-muted">
            <div className="w-12 shrink-0" />
            <div className="flex-1">שם המוצר</div>
            <div className="w-[90px] shrink-0">קטגוריה</div>
            <div className="w-[180px] shrink-0">מידות ומחירים</div>
            <div className="w-[72px] shrink-0" />
          </div>
          {filtered.map(p => (
            <ProductListRow
              key={p.id}
              product={p}
              onEdit={() => openEdit(p)}
              onDuplicate={() => duplicateProduct(p)}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      {showDrawer && (
        <ProductDrawer
          product={editProduct}
          onClose={() => { setShowDrawer(false); setEditProduct(null) }}
          onSave={onSave}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      )}
    </div>
  )
}
