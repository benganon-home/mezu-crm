'use client'

import { useState, useRef } from 'react'
import { X, Plus, Trash2, Upload, ImageIcon, AlertTriangle, Check } from 'lucide-react'
import { Product } from '@/types'
import { formatPrice, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useDrawerAnimation } from '@/hooks/useDrawerAnimation'

const CATEGORIES = ['מזוזות', 'שלטי בית', 'מתנות', 'אחר']

interface Props {
  product?: Product | null
  onClose: () => void
  onSave: (product: Product) => void
  onDelete?: (id: string) => void
}

export function ProductDrawer({ product, onClose, onSave, onDelete }: Props) {
  const { visible, close } = useDrawerAnimation(onClose)
  const isEdit = !!product

  const [name, setName]               = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const [basePrice, setBasePrice]     = useState(product?.base_price?.toString() || '')
  const [category, setCategory]       = useState(product?.category || '')
  const [isActive, setIsActive]       = useState(product?.is_active ?? true)
  const [images, setImages]           = useState<string[]>(product?.images || [])
  const [sizes, setSizes]             = useState<string[]>(product?.sizes || [])
  const [newSize, setNewSize]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addSize = () => {
    const s = newSize.trim()
    if (s && !sizes.includes(s)) setSizes(prev => [...prev, s])
    setNewSize('')
  }

  const removeSize = (s: string) => setSizes(prev => prev.filter(x => x !== s))

  const uploadImage = async (file: File) => {
    setUploadingImage(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `products/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setImages(prev => [...prev, data.publicUrl])
    } catch (e) {
      console.error('Image upload failed', e)
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
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
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
    onSave(saved)
    setSaving(false)
    close()
  }

  const handleDelete = async () => {
    if (!product) return
    setDeleting(true)
    await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    onDelete?.(product.id)
    close()
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
              למחוק את <span className="font-medium text-navy dark:text-cream">"{name}"</span>?<br />
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
            {images.length === 0 && (
              <p className="text-xs text-muted/60 mt-1.5">הוסף תמונה ראשונה — תופיע בקארד המוצר</p>
            )}
          </div>

          {/* Name */}
          <div>
            <div className="label mb-1.5">שם המוצר *</div>
            <input
              className="input w-full"
              placeholder="למשל: מזוזה מעוצבת שחורה"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus={!isEdit}
            />
          </div>

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1.5">קטגוריה</div>
              <select
                className="input w-full"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="">— בחר —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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

          {/* Description */}
          <div>
            <div className="label mb-1.5">תיאור</div>
            <textarea
              className="input w-full min-h-[80px] resize-none"
              placeholder="תיאור קצר של המוצר, חומר, סגנון..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Sizes */}
          <div>
            <div className="label mb-2">מידות</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sizes.map(s => (
                <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-cream dark:bg-navy-deeper border border-cream-dark dark:border-navy-light rounded-full text-xs">
                  {s}
                  <button onClick={() => removeSize(s)} className="text-muted hover:text-red-500 transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="למשל: 10 ס״מ"
                value={newSize}
                onChange={e => setNewSize(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSize()}
              />
              <button onClick={addSize} className="btn-secondary text-xs px-3">
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
                'w-4.5 h-4.5 rounded-full bg-white shadow absolute top-0.5 transition-all',
                isActive ? 'right-0.5' : 'right-5.5'
              )} />
            </button>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={15} />
            {saving ? 'שומר...' : isEdit ? 'שמור שינויים' : 'צור מוצר'}
          </button>

          {/* Delete */}
          {isEdit && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5 rounded-full transition-colors"
            >
              <Trash2 size={14} />
              מחיקת מוצר
            </button>
          )}
        </div>
      </div>
    </>
  )
}
