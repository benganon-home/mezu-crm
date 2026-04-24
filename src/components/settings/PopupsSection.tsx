'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Monitor, X, Search, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Popup {
  id: string
  image_url: string | null
  title: string | null
  body: string | null
  cta_text: string | null
  cta_product_id: string | null
  cta_category_id: string | null
  is_active: boolean
  show_after_seconds: number
  display_order: number
}

interface MiniProduct {
  id: string
  name: string
  images: string[] | null
}

interface MiniCategory {
  id: string
  name_he: string
  slug: string | null
}

export function PopupsSection() {
  const [popups, setPopups]       = useState<Popup[]>([])
  const [products, setProducts]   = useState<MiniProduct[]>([])
  const [categories, setCategories] = useState<MiniCategory[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<Popup | null>(null)
  const [saving, setSaving]       = useState(false)

  const load = async () => {
    setLoading(true)
    const [pRes, prodRes, catRes] = await Promise.all([
      fetch('/api/popups').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/product-categories').then(r => r.json()),
    ])
    setPopups(Array.isArray(pRes) ? pRes : [])
    setProducts(Array.isArray(prodRes) ? prodRes.map((p: any) => ({ id: p.id, name: p.name, images: p.images })) : [])
    setCategories(Array.isArray(catRes) ? catRes.map((c: any) => ({ id: c.id, name_he: c.name_he, slug: c.slug })) : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const startNew = () => {
    setEditing({
      id: 'new',
      image_url: null,
      title: '',
      body: '',
      cta_text: '',
      cta_product_id: null,
      cta_category_id: null,
      is_active: true,
      show_after_seconds: 3,
      display_order: popups.length,
    })
  }

  const toggleActive = async (p: Popup) => {
    setPopups(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
    await fetch(`/api/popups/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
  }

  const deletePopup = async (id: string) => {
    if (!confirm('למחוק את הפופאפ?')) return
    setPopups(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/popups/${id}`, { method: 'DELETE' })
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const isNew = editing.id === 'new'
    const { id, ...payload } = editing
    const res = await fetch(isNew ? '/api/popups' : `/api/popups/${id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) return
    setEditing(null)
    load()
  }

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-gold" strokeWidth={1.5} />
          <h3>פופאפים בחנות</h3>
        </div>
        <button onClick={startNew} className="btn-ghost flex items-center gap-1.5 text-xs">
          <Plus size={13} /> חדש
        </button>
      </div>

      <p className="text-xs text-muted mb-4">
        פופאפ על דף הבית של החנות. מוצג פעם אחת לכל מבקר — לא חוזר כשחוזרים לאתר.
      </p>

      {loading ? (
        <div className="text-xs text-muted py-4 text-center">טוען...</div>
      ) : popups.length === 0 ? (
        <div className="text-xs text-muted text-center py-4">אין פופאפים</div>
      ) : (
        <div className="space-y-2">
          {popups.map(p => {
            const product  = p.cta_product_id  ? products.find(x => x.id === p.cta_product_id)   : null
            const category = p.cta_category_id ? categories.find(x => x.id === p.cta_category_id) : null
            const linkLabel = product
              ? `→ מוצר: ${product.name}`
              : category
                ? `→ קטגוריה: ${category.name_he}`
                : p.cta_text || 'ללא כפתור'
            return (
              <div key={p.id} className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                p.is_active ? 'border-line bg-white dark:bg-navy-light' : 'border-line/50 bg-cream-dark/30 dark:bg-navy/50 opacity-60'
              )}>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-cream-dark/50 dark:bg-navy-light grid place-items-center shrink-0">
                    <ImageIcon size={14} className="text-muted" />
                  </div>
                )}

                <button onClick={() => setEditing(p)} className="flex-1 min-w-0 text-right">
                  <div className="text-sm font-medium truncate">{p.title || '(ללא כותרת)'}</div>
                  <div className="text-xs text-muted truncate">
                    {linkLabel}
                  </div>
                </button>

                <button
                  onClick={() => toggleActive(p)}
                  className={cn('shrink-0 transition-colors', p.is_active ? 'text-green-500' : 'text-muted')}
                >
                  <span className="text-xs font-medium">{p.is_active ? 'פעיל' : 'כבוי'}</span>
                </button>

                <button
                  onClick={() => deletePopup(p.id)}
                  className="text-muted hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <PopupEditor
          popup={editing}
          products={products}
          categories={categories}
          saving={saving}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  )
}

function PopupEditor({
  popup, products, categories, saving, onChange, onClose, onSave,
}: {
  popup: Popup
  products: MiniProduct[]
  categories: MiniCategory[]
  saving: boolean
  onChange: (p: Popup) => void
  onClose: () => void
  onSave: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch]       = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [linkKind, setLinkKind]   = useState<'product' | 'category'>(
    popup.cta_category_id ? 'category' : 'product'
  )

  const selectedProduct = useMemo(
    () => popup.cta_product_id ? products.find(p => p.id === popup.cta_product_id) : null,
    [popup.cta_product_id, products],
  )

  const selectedCategory = useMemo(
    () => popup.cta_category_id ? categories.find(c => c.id === popup.cta_category_id) : null,
    [popup.cta_category_id, categories],
  )

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 30)
    const q = search.trim().toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30)
  }, [search, products])

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.trim().toLowerCase()
    return categories.filter(c => c.name_he.toLowerCase().includes(q))
  }, [search, categories])

  const switchLinkKind = (kind: 'product' | 'category') => {
    setLinkKind(kind)
    setSearch('')
    setPickerOpen(false)
    // Clear the opposite field so only one is set
    if (kind === 'product') {
      onChange({ ...popup, cta_category_id: null })
    } else {
      onChange({ ...popup, cta_product_id: null })
    }
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `popups/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      onChange({ ...popup, image_url: data.publicUrl })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div
        className="surface p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3>{popup.id === 'new' ? 'פופאפ חדש' : 'עריכת פופאפ'}</h3>
          <button onClick={onClose} className="btn-ghost !p-1.5">
            <X size={16} />
          </button>
        </div>

        {/* Image */}
        <label className="label block mb-1.5">תמונה</label>
        <div className="mb-4">
          {popup.image_url ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={popup.image_url} alt="" className="w-full aspect-video object-cover rounded-lg" />
              <button
                onClick={() => onChange({ ...popup, image_url: null })}
                className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full aspect-video rounded-lg border-2 border-dashed border-cream-dark dark:border-navy-light grid place-items-center text-muted hover:text-gold hover:border-gold transition-colors"
            >
              {uploading ? 'מעלה...' : '+ העלאת תמונה'}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) uploadImage(f)
              e.target.value = ''
            }}
          />
        </div>

        {/* Title */}
        <label className="label block mb-1.5">כותרת</label>
        <input
          type="text"
          value={popup.title || ''}
          onChange={e => onChange({ ...popup, title: e.target.value })}
          className="input w-full mb-4"
          placeholder="לדוגמה: הנחה של 20%"
        />

        {/* Body */}
        <label className="label block mb-1.5">טקסט</label>
        <textarea
          value={popup.body || ''}
          onChange={e => onChange({ ...popup, body: e.target.value })}
          className="input w-full min-h-[80px] resize-none mb-4"
          placeholder="תיאור קצר..."
        />

        {/* CTA text */}
        <label className="label block mb-1.5">טקסט על הכפתור</label>
        <input
          type="text"
          value={popup.cta_text || ''}
          onChange={e => onChange({ ...popup, cta_text: e.target.value })}
          className="input w-full mb-4"
          placeholder="לדוגמה: לצפייה במוצר"
        />

        {/* CTA link target */}
        <label className="label block mb-1.5">כפתור מקשר ל־</label>
        <div className="flex gap-1 mb-2 p-0.5 rounded-lg bg-cream-dark/40 dark:bg-navy-light/40">
          <button
            type="button"
            onClick={() => switchLinkKind('product')}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-md transition-colors',
              linkKind === 'product' ? 'bg-white dark:bg-navy font-medium shadow-sm' : 'text-muted'
            )}
          >
            מוצר
          </button>
          <button
            type="button"
            onClick={() => switchLinkKind('category')}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-md transition-colors',
              linkKind === 'category' ? 'bg-white dark:bg-navy font-medium shadow-sm' : 'text-muted'
            )}
          >
            קטגוריה
          </button>
        </div>

        {linkKind === 'product' ? (
          selectedProduct ? (
            <div className="flex items-center gap-2 border border-line rounded-lg px-3 py-2 mb-4">
              {selectedProduct.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedProduct.images[0]} alt="" className="w-8 h-8 object-cover rounded" />
              )}
              <span className="flex-1 text-sm truncate">{selectedProduct.name}</span>
              <button
                onClick={() => onChange({ ...popup, cta_product_id: null })}
                className="text-muted hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPickerOpen(v => !v)}
              className="w-full border border-line rounded-lg px-3 py-2 text-right text-sm text-muted hover:text-ink hover:border-gold transition-colors mb-2"
            >
              <Search size={13} className="inline me-2" />
              בחר מוצר...
            </button>
          )
        ) : (
          selectedCategory ? (
            <div className="flex items-center gap-2 border border-line rounded-lg px-3 py-2 mb-4">
              <span className="flex-1 text-sm truncate">{selectedCategory.name_he}</span>
              <button
                onClick={() => onChange({ ...popup, cta_category_id: null })}
                className="text-muted hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPickerOpen(v => !v)}
              className="w-full border border-line rounded-lg px-3 py-2 text-right text-sm text-muted hover:text-ink hover:border-gold transition-colors mb-2"
            >
              <Search size={13} className="inline me-2" />
              בחר קטגוריה...
            </button>
          )
        )}

        {pickerOpen && linkKind === 'product' && !selectedProduct && (
          <div className="mb-4 border border-line rounded-lg bg-cream-dark/30 dark:bg-navy-light/40 p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש מוצר..."
              className="input w-full mb-2 !text-sm"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onChange({ ...popup, cta_product_id: p.id, cta_category_id: null }); setPickerOpen(false); setSearch('') }}
                  className="w-full flex items-center gap-2 text-right px-2 py-1.5 rounded hover:bg-gold/10 text-sm"
                >
                  {p.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="w-7 h-7 object-cover rounded" />
                  )}
                  <span className="flex-1 truncate">{p.name}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-xs text-muted text-center py-3">לא נמצאו מוצרים</div>
              )}
            </div>
          </div>
        )}

        {pickerOpen && linkKind === 'category' && !selectedCategory && (
          <div className="mb-4 border border-line rounded-lg bg-cream-dark/30 dark:bg-navy-light/40 p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש קטגוריה..."
              className="input w-full mb-2 !text-sm"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredCategories.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onChange({ ...popup, cta_category_id: c.id, cta_product_id: null }); setPickerOpen(false); setSearch('') }}
                  className="w-full flex items-center gap-2 text-right px-2 py-1.5 rounded hover:bg-gold/10 text-sm"
                >
                  <span className="flex-1 truncate">{c.name_he}</span>
                </button>
              ))}
              {filteredCategories.length === 0 && (
                <div className="text-xs text-muted text-center py-3">לא נמצאו קטגוריות</div>
              )}
            </div>
          </div>
        )}

        {/* Timing */}
        <label className="label block mb-1.5">הצג אחרי (שניות)</label>
        <input
          type="number"
          min={0}
          max={60}
          value={popup.show_after_seconds}
          onChange={e => onChange({ ...popup, show_after_seconds: parseInt(e.target.value) || 0 })}
          className="input w-full mb-4"
        />

        <div className="flex items-center justify-between gap-2 pt-4 border-t border-line">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={popup.is_active}
              onChange={e => onChange({ ...popup, is_active: e.target.checked })}
            />
            פעיל
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-xs">ביטול</button>
            <button onClick={onSave} disabled={saving} className="btn-primary text-xs px-4">
              {saving ? '...' : 'שמירה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
