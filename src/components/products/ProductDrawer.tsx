'use client'

import { useState, useRef } from 'react'
import { X, Plus, Trash2, Upload, AlertTriangle, Check, Copy } from 'lucide-react'
import { Product, ProductSize } from '@/types'
import { formatPrice, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useDrawerAnimation } from '@/hooks/useDrawerAnimation'

const DEFAULT_CATEGORIES = ['מזוזות', 'שלטי בית', 'ברכות', 'אחר']

interface Props {
  product?: Product | null
  onClose: () => void
  onSave: (product: Product) => void
  onDelete?: (id: string) => void
  onDuplicate?: (product: Product) => void
}

export function ProductDrawer({ product, onClose, onSave, onDelete, onDuplicate }: Props) {
  const { visible, close } = useDrawerAnimation(onClose)
  const isEdit = !!product

  const [name, setName]               = useState(product?.name || '')
  const [slug, setSlug]               = useState(product?.slug || '')
  const [slugManual, setSlugManual]   = useState(!!product?.slug)
  const [subtitle, setSubtitle]       = useState(product?.subtitle || '')
  const [description, setDescription] = useState(product?.description || '')
  const [longDescription, setLongDescription] = useState(product?.long_description || '')
  const [materials, setMaterials]     = useState(product?.materials || '')
  const [careInstructions, setCareInstructions] = useState(product?.care_instructions || '')
  const [basePrice, setBasePrice]     = useState(product?.base_price?.toString() || '')
  const [category, setCategory]       = useState(product?.category || '')
  const [newCategory, setNewCategory] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [isActive, setIsActive]       = useState(product?.is_active ?? true)
  const [images, setImages]           = useState<string[]>(product?.images || [])
  const [sizes, setSizes]             = useState<ProductSize[]>(product?.sizes || [])

  // Auto-generate slug from name (unless manually edited)
  const autoSlug = (text: string) =>
    text.trim().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u0590-\u05FF-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

  // Merge default + DB categories
  const [dbCategories, setDbCategories] = useState<string[]>([])
  useState(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((prods: any[]) => {
        const cats = new Set(DEFAULT_CATEGORIES)
        prods.forEach((p: any) => { if (p.category) cats.add(p.category) })
        setDbCategories(Array.from(cats))
      })
      .catch(() => setDbCategories([...DEFAULT_CATEGORIES]))
  })
  const categories = dbCategories.length > 0 ? dbCategories : DEFAULT_CATEGORIES

  const createCategory = async () => {
    const name = newCategory.trim()
    if (!name) { setAddingCategory(false); return }
    // Create in product_categories table
    await fetch('/api/product-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name_he: name }),
    })
    setCategory(name)
    setDbCategories(prev => [...new Set([...prev, name])])
    setNewCategory('')
    setAddingCategory(false)
  }
  const [newSizeLabel, setNewSizeLabel] = useState('')
  const [newSizePrice, setNewSizePrice] = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addSize = () => {
    const label = newSizeLabel.trim()
    if (!label) return
    const price = parseFloat(newSizePrice) || 0
    setSizes(prev => [...prev, { label, price }])
    setNewSizeLabel('')
    setNewSizePrice('')
  }

  const removeSize = (i: number) => setSizes(prev => prev.filter((_, idx) => idx !== i))

  const updateSizePrice = (i: number, price: string) =>
    setSizes(prev => prev.map((s, idx) => idx === i ? { ...s, price: parseFloat(price) || 0 } : s))

  const updateSizeLabel = (i: number, label: string) =>
    setSizes(prev => prev.map((s, idx) => idx === i ? { ...s, label } : s))

  const uploadImage = async (file: File) => {
    setUploadingImage(true)
    setUploadError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `products/${Date.now()}.${ext}`
      const { error: err } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true })
      if (err) throw err
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setImages(prev => [...prev, data.publicUrl])
    } catch (e: any) {
      setUploadError(e?.message || 'שגיאה בהעלאת תמונה')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadImage(file)
    e.target.value = ''
  }

  const removeImage = (url: string) => setImages(prev => prev.filter(u => u !== url))

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const finalSlug = (slug.trim() || autoSlug(name)) || null
    const payload = {
      name: name.trim(),
      slug: finalSlug,
      subtitle: subtitle.trim() || null,
      description: description.trim() || null,
      long_description: longDescription.trim() || null,
      materials: materials.trim() || null,
      care_instructions: careInstructions.trim() || null,
      base_price: parseFloat(basePrice) || 0,
      category: category || null,
      is_active: isActive,
      images,
      sizes,
      colors: product?.colors || [],
    }

    const url    = isEdit ? `/api/products/${product!.id}` : '/api/products'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const saved = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveError(saved.error || 'שגיאה בשמירה'); return }
    setSaveError(null)
    onSave(saved)
    close()
  }

  const handleDelete = async () => {
    if (!product) return
    setDeleting(true)
    await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    onDelete?.(product.id)
    close()
  }

  const handleDuplicate = async () => {
    if (!product) return
    const payload = {
      name: `עותק של ${product.name}`,
      slug: null,
      subtitle: product.subtitle,
      description: product.description,
      long_description: product.long_description,
      materials: product.materials,
      care_instructions: product.care_instructions,
      base_price: product.base_price,
      category: product.category,
      is_active: true,
      images: product.images,
      sizes: product.sizes,
      colors: product.colors,
    }
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const cloned = await res.json()
    if (res.ok) { onDuplicate?.(cloned); close() }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={close}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-white dark:bg-navy-dark rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1">מחיקת מוצר</h3>
            <p className="text-sm text-muted mb-5">
              למחוק את <span className="font-medium text-navy dark:text-cream">&quot;{name}&quot;</span>?<br />
              פעולה זו אינה ניתנת לביטול.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-full transition-colors disabled:opacity-50">
                {deleting ? 'מוחק...' : 'כן, מחק'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 btn-secondary py-2.5">ביטול</button>
            </div>
          </div>
        </div>
      )}

      <div className={cn('drawer', visible && 'open')}>

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-navy-dark border-b border-cream-dark dark:border-navy-light px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-base">{isEdit ? 'עריכת מוצר' : 'מוצר חדש'}</h2>
          <button onClick={close} className="text-muted hover:text-navy dark:hover:text-cream p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-5">

          {/* Images */}
          <div>
            <div className="label mb-2">תמונות</div>
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, i) => (
                <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-cream-dark dark:bg-navy-light">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(url)}
                    className="absolute top-1.5 left-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={11} className="text-white" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-1 right-1 text-[10px] bg-navy/70 text-cream px-1.5 py-0.5 rounded-full">ראשי</div>
                  )}
                </div>
              ))}

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className={cn(
                  'aspect-square rounded-xl border-2 border-dashed border-cream-dark dark:border-navy-light flex flex-col items-center justify-center gap-1.5 transition-colors',
                  'hover:border-gold hover:bg-gold/5 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {uploadingImage
                  ? <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  : <>
                      <Upload size={16} className="text-muted" />
                      <span className="text-[10px] text-muted">העלה</span>
                    </>
                }
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {images.length === 0 && !uploadError && (
              <p className="text-xs text-muted/60 mt-1.5">הוסף תמונה ראשונה — תופיע בקארד המוצר</p>
            )}
            {uploadError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{uploadError}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <div className="label mb-1.5">שם המוצר *</div>
            <input
              className="input w-full"
              placeholder="למשל: מזוזה מעוצבת שחורה"
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (!slugManual) setSlug(autoSlug(e.target.value))
              }}
              autoFocus={!isEdit}
            />
          </div>

          {/* Slug */}
          <div>
            <div className="label mb-1.5">כתובת URL</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted shrink-0 ltr">/product/</span>
              <input
                className="input w-full text-sm ltr"
                placeholder={autoSlug(name) || 'auto-generated'}
                value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); setSlugManual(true) }}
                dir="ltr"
              />
            </div>
            {!slugManual && name.trim() && (
              <p className="text-[10px] text-muted mt-1">נוצר אוטומטית משם המוצר. ניתן לערוך ידנית.</p>
            )}
          </div>

          {/* Subtitle */}
          <div>
            <div className="label mb-1.5">כותרת משנה</div>
            <input
              className="input w-full"
              placeholder="טקסט קצר שמופיע מתחת לשם, למשל: דגם סטנדרטי 18 ס״מ"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
            />
          </div>

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1.5">קטגוריה</div>
              {addingCategory ? (
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="שם קטגוריה חדשה"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createCategory() }}
                    autoFocus
                  />
                  <button
                    onClick={createCategory}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {newCategory.trim() ? '✓' : '✕'}
                  </button>
                </div>
              ) : (
                <select
                  className="input w-full"
                  value={category}
                  onChange={e => {
                    if (e.target.value === '__new__') {
                      setAddingCategory(true)
                    } else {
                      setCategory(e.target.value)
                    }
                  }}
                >
                  <option value="">— בחר —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ קטגוריה חדשה</option>
                </select>
              )}
            </div>
            <div>
              <div className="label mb-1.5">מחיר בסיס (₪)</div>
              <input
                className="input w-full ltr"
                placeholder="0"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                type="number"
                min="0"
                dir="ltr"
              />
            </div>
          </div>

          {/* Short description */}
          <div>
            <div className="label mb-1.5">תיאור קצר</div>
            <textarea
              className="input w-full min-h-[60px] resize-none"
              placeholder="שורה או שתיים — יופיע בקארד המוצר"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Long description */}
          <div>
            <div className="label mb-1.5">תיאור מלא</div>
            <textarea
              className="input w-full min-h-[120px] resize-y"
              placeholder="פירוט מלא של המוצר — חומר, תהליך ייצור, סגנון, פרטים ייחודיים. תומך ב-Markdown (## כותרות, **מודגש**, רשימות וכו׳)"
              value={longDescription}
              onChange={e => setLongDescription(e.target.value)}
            />
            <p className="text-[11px] text-muted mt-1">יופיע בעמוד המוצר באתר</p>
          </div>

          {/* Materials */}
          <div>
            <div className="label mb-1.5">חומרים</div>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              placeholder="ממה עשוי המוצר — PLA, PETG, מתכת, עץ, גימור וכו'"
              value={materials}
              onChange={e => setMaterials(e.target.value)}
            />
          </div>

          {/* Care / warnings */}
          <div>
            <div className="label mb-1.5">הוראות שימוש ואזהרות</div>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              placeholder="איך להשתמש / לנקות / מה לא לעשות (חום, רטיבות וכו')"
              value={careInstructions}
              onChange={e => setCareInstructions(e.target.value)}
            />
          </div>

          {/* Sizes */}
          <div>
            <div className="label mb-2">מידות ומחירים</div>

            {sizes.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {/* Header */}
                <div className="grid grid-cols-[1fr_100px_28px] gap-2 px-1">
                  <span className="text-[10px] text-muted uppercase tracking-wide">מידה</span>
                  <span className="text-[10px] text-muted uppercase tracking-wide ltr text-right">מחיר (₪)</span>
                  <span />
                </div>
                {sizes.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_28px] gap-2 items-center">
                    <input
                      className="input text-sm"
                      value={s.label}
                      onChange={e => updateSizeLabel(i, e.target.value)}
                      placeholder="מידה"
                    />
                    <input
                      className="input text-sm ltr text-right"
                      type="number"
                      min="0"
                      value={s.price || ''}
                      onChange={e => updateSizePrice(i, e.target.value)}
                      placeholder="0"
                      dir="ltr"
                    />
                    <button
                      onClick={() => removeSize(i)}
                      className="w-7 h-7 flex items-center justify-center text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new size row */}
            <div className="grid grid-cols-[1fr_100px_28px] gap-2 items-center">
              <input
                className="input text-sm"
                placeholder="מידה חדשה"
                value={newSizeLabel}
                onChange={e => setNewSizeLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSize()}
              />
              <input
                className="input text-sm ltr text-right"
                type="number"
                min="0"
                placeholder="מחיר"
                value={newSizePrice}
                onChange={e => setNewSizePrice(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSize()}
                dir="ltr"
              />
              <button
                onClick={addSize}
                disabled={!newSizeLabel.trim()}
                className="w-7 h-7 flex items-center justify-center bg-gold text-white rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-3 border-t border-cream-dark dark:border-navy-light">
            <div>
              <div className="text-sm font-medium">מוצר פעיל</div>
              <div className="text-xs text-muted mt-0.5">מוצרים לא פעילים לא יופיעו בבחירה</div>
            </div>
            <button
              onClick={() => setIsActive(v => !v)}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative shrink-0',
                isActive ? 'bg-gold' : 'bg-cream-dark dark:bg-navy-light'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all duration-200',
                isActive ? 'right-0.5' : 'left-0.5'
              )} />
            </button>
          </div>

          {/* Save error */}
          {saveError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={15} />
            {saving ? 'שומר...' : isEdit ? 'שמור שינויים' : 'צור מוצר'}
          </button>

          {/* Duplicate + Delete */}
          {isEdit && (
            <div className="flex gap-2">
              <button
                onClick={handleDuplicate}
                className="flex-1 flex items-center justify-center gap-2 text-sm text-muted hover:text-navy dark:hover:text-cream hover:bg-cream-dark dark:hover:bg-navy-light py-2.5 rounded-full transition-colors border border-cream-dark dark:border-navy-light"
              >
                <Copy size={14} />
                שכפל מוצר
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5 rounded-full transition-colors"
              >
                <Trash2 size={14} />
                מחיקה
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
