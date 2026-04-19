'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, GripVertical, Upload, X, Check, Loader2, Eye, EyeOff, AlertTriangle,
} from 'lucide-react'
import type { ProductCategory } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<string | null>(null) // id of category being edited
  const [adding, setAdding]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/product-categories')
    const data = await res.json()
    setCategories(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/product-categories/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="page-header">
        <div>
          <h1>קטגוריות</h1>
          <p className="text-xs text-muted mt-0.5">{categories.length} קטגוריות באתר</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={14} strokeWidth={1.5} /> קטגוריה חדשה
        </button>
      </div>

      {loading && <div className="text-sm text-muted">טוען...</div>}

      {/* Add new form */}
      {adding && (
        <CategoryForm
          onSave={async (cat) => {
            const res = await fetch('/api/product-categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cat),
            })
            if (res.ok) { setAdding(false); load() }
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* List */}
      <div className="flex flex-col gap-3">
        {categories.map(cat => (
          <div key={cat.id}>
            {editing === cat.id ? (
              <CategoryForm
                initial={cat}
                onSave={async (patch) => {
                  await fetch(`/api/product-categories/${cat.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                  })
                  setEditing(null)
                  load()
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="surface px-4 py-3 flex items-center gap-3">
                {/* Hero image thumbnail */}
                <div className="h-12 w-12 rounded-lg overflow-hidden bg-cream-dark dark:bg-navy-light shrink-0">
                  {cat.hero_image ? (
                    <img src={cat.hero_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted/30">
                      {cat.name_he.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{cat.name_he}</span>
                    <span className="text-[10px] text-muted ltr">/{cat.slug}</span>
                    {!cat.is_active && (
                      <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">מוסתר</span>
                    )}
                  </div>
                  {cat.description && (
                    <p className="text-xs text-muted mt-0.5 truncate">{cat.description}</p>
                  )}
                </div>

                {/* Order badge */}
                <span className="text-xs text-muted tabular-nums shrink-0">#{cat.display_order}</span>

                {/* Actions */}
                <button
                  onClick={() => setEditing(cat.id)}
                  className="text-xs text-muted hover:text-navy dark:hover:text-cream px-2 py-1 rounded hover:bg-cream-dark dark:hover:bg-navy-light transition-colors"
                >
                  ערוך
                </button>
                <button
                  onClick={() => setConfirmDelete(cat.id)}
                  className="text-muted hover:text-red-500 p-1 rounded transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            {/* Delete confirm */}
            {confirmDelete === cat.id && (
              <div className="mt-2 surface p-4 border-red-200 dark:border-red-800 flex items-center gap-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                <span className="text-sm flex-1">למחוק את "{cat.name_he}"? מוצרים בקטגוריה זו יישארו ללא קטגוריה.</span>
                <button onClick={() => handleDelete(cat.id)} className="text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-full transition-colors">מחק</button>
                <button onClick={() => setConfirmDelete(null)} className="text-xs text-muted hover:text-navy px-2 py-1.5">ביטול</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Category form (create + edit) ─────────────────────────────

function CategoryForm({
  initial, onSave, onCancel,
}: {
  initial?:  ProductCategory
  onSave:    (data: Partial<ProductCategory>) => Promise<void>
  onCancel:  () => void
}) {
  const [nameHe, setNameHe]           = useState(initial?.name_he || '')
  const [slug, setSlug]               = useState(initial?.slug || '')
  const [slugManual, setSlugManual]   = useState(!!initial?.slug)
  const [description, setDescription] = useState(initial?.description || '')
  const [heroImage, setHeroImage]     = useState(initial?.hero_image || '')
  const [displayOrder, setDisplayOrder] = useState(String(initial?.display_order ?? 0))
  const [isActive, setIsActive]       = useState(initial?.is_active ?? true)
  const [seoTitle, setSeoTitle]       = useState(initial?.seo_title || '')
  const [seoDesc, setSeoDesc]         = useState(initial?.seo_description || '')
  const [saving, setSaving]           = useState(false)
  const [uploading, setUploading]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const autoSlug = (text: string) =>
    text.trim().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u0590-\u05FF-]/g, '')

  const handleUpload = async (file: File) => {
    setUploading(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop()
    const path = `categories/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setHeroImage(data.publicUrl)
    }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!nameHe.trim()) return
    setSaving(true)
    await onSave({
      name_he:         nameHe.trim(),
      slug:            slug.trim() || autoSlug(nameHe),
      description:     description.trim() || null,
      hero_image:      heroImage || null,
      display_order:   parseInt(displayOrder) || 0,
      is_active:       isActive,
      seo_title:       seoTitle.trim() || null,
      seo_description: seoDesc.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div className="surface p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label mb-1.5">שם הקטגוריה *</div>
          <input
            className="input w-full"
            value={nameHe}
            onChange={e => {
              setNameHe(e.target.value)
              if (!slugManual) setSlug(autoSlug(e.target.value))
            }}
            placeholder="למשל: מנורות"
            autoFocus
          />
        </div>
        <div>
          <div className="label mb-1.5">Slug (כתובת URL)</div>
          <input
            className="input w-full text-sm ltr"
            value={slug}
            onChange={e => { setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); setSlugManual(true) }}
            placeholder={autoSlug(nameHe) || 'auto'}
            dir="ltr"
          />
        </div>
      </div>

      <div>
        <div className="label mb-1.5">תיאור</div>
        <textarea
          className="input w-full min-h-[60px] resize-none text-sm"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="תיאור קצר שיופיע בעמוד הקטגוריה"
        />
      </div>

      {/* Hero image */}
      <div>
        <div className="label mb-1.5">תמונת קטגוריה</div>
        <div className="flex items-center gap-3">
          {heroImage ? (
            <div className="relative h-16 w-24 rounded-lg overflow-hidden bg-cream-dark">
              <img src={heroImage} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setHeroImage('')}
                className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="h-16 w-24 rounded-lg border-2 border-dashed border-cream-dark hover:border-gold flex items-center justify-center transition-colors"
            >
              {uploading
                ? <Loader2 size={16} className="animate-spin text-gold" />
                : <Upload size={16} className="text-muted" />
              }
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = '' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label mb-1.5">סדר תצוגה</div>
          <input
            className="input w-full text-sm ltr"
            type="number"
            value={displayOrder}
            onChange={e => setDisplayOrder(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="flex items-end pb-1">
          <button
            onClick={() => setIsActive(v => !v)}
            className="flex items-center gap-2 text-sm"
          >
            {isActive
              ? <><Eye size={14} className="text-emerald-500" /> פעיל באתר</>
              : <><EyeOff size={14} className="text-red-500" /> מוסתר</>
            }
          </button>
        </div>
      </div>

      {/* SEO */}
      <details className="group">
        <summary className="label cursor-pointer select-none flex items-center gap-1">
          <span>הגדרות SEO</span>
          <span className="text-[10px] text-muted">(אופציונלי)</span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <div className="label mb-1.5">כותרת SEO</div>
            <input className="input w-full text-sm" value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder={nameHe} />
          </div>
          <div>
            <div className="label mb-1.5">תיאור SEO</div>
            <textarea className="input w-full text-sm min-h-[50px] resize-none" value={seoDesc} onChange={e => setSeoDesc(e.target.value)} placeholder="תיאור לגוגל" />
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !nameHe.trim()}
          className="btn-primary flex items-center gap-2 flex-1 justify-center disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {initial ? 'שמור' : 'צור קטגוריה'}
        </button>
        <button onClick={onCancel} className="btn-secondary flex-1">ביטול</button>
      </div>
    </div>
  )
}
