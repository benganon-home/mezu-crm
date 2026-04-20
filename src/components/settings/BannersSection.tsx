'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, GripVertical, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Banner {
  id: string
  text: string
  is_active: boolean
  display_order: number
}

export function BannersSection() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [newText, setNewText] = useState('')
  const [saving, setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/banners')
    const data = await res.json()
    setBanners(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const addBanner = async () => {
    if (!newText.trim()) return
    setSaving(true)
    const res = await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: newText.trim(),
        is_active: true,
        display_order: banners.length,
      }),
    })
    setSaving(false)
    if (!res.ok) return
    setNewText('')
    setAdding(false)
    load()
  }

  const toggleActive = async (b: Banner) => {
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !x.is_active } : x))
    await fetch(`/api/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !b.is_active }),
    })
  }

  const deleteBanner = async (id: string) => {
    setBanners(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/banners/${id}`, { method: 'DELETE' })
  }

  const updateText = async (b: Banner, text: string) => {
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, text } : x))
    await fetch(`/api/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  }

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-gold" strokeWidth={1.5} />
          <h3>באנרים באתר</h3>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-ghost flex items-center gap-1.5 text-xs">
            <Plus size={13} /> הוסף
          </button>
        )}
      </div>

      <p className="text-xs text-muted mb-4">
        באנר כהה מתחת לתפריט העליון. באנר אחד מוצג תמיד, שניים או יותר מתחלפים כל 5 שניות.
      </p>

      {loading ? (
        <div className="text-xs text-muted py-4 text-center">טוען...</div>
      ) : (
        <div className="space-y-2">
          {banners.map(b => (
            <div key={b.id} className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
              b.is_active ? 'border-line bg-white dark:bg-navy-light' : 'border-line/50 bg-cream-dark/30 dark:bg-navy/50 opacity-60'
            )}>
              <GripVertical size={14} className="text-muted/40 shrink-0" />

              <input
                type="text"
                value={b.text}
                onChange={e => updateText(b, e.target.value)}
                className="input flex-1 text-sm !py-1 !px-2 !min-h-0"
              />

              <button
                onClick={() => toggleActive(b)}
                className={cn('shrink-0 transition-colors', b.is_active ? 'text-green-500' : 'text-muted')}
                title={b.is_active ? 'פעיל' : 'לא פעיל'}
              >
                {b.is_active ? <span className="text-xs font-medium">פעיל</span> : <span className="text-xs">כבוי</span>}
              </button>

              <button
                onClick={() => deleteBanner(b.id)}
                className="text-muted hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}

          {banners.length === 0 && !adding && (
            <div className="text-xs text-muted text-center py-4">אין באנרים פעילים</div>
          )}
        </div>
      )}

      {adding && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="טקסט הבאנר..."
            className="input flex-1 text-sm"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && addBanner()}
          />
          <button onClick={addBanner} disabled={saving} className="btn-primary text-xs px-4">
            {saving ? '...' : 'הוסף'}
          </button>
          <button onClick={() => { setAdding(false); setNewText('') }} className="btn-ghost text-xs">
            ביטול
          </button>
        </div>
      )}
    </div>
  )
}
