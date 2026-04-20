'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Tag, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Coupon {
  id: string
  code: string
  discount_type: 'free_shipping' | 'percent' | 'fixed'
  discount_value: number
  min_order: number
  max_uses: number | null
  used_count: number
  is_active: boolean
  expires_at: string | null
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  free_shipping: 'משלוח חינם',
  percent:       'אחוז הנחה',
  fixed:         'סכום קבוע',
}

export function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)

  // New coupon form
  const [code, setCode]             = useState('')
  const [discountType, setDiscountType] = useState<'free_shipping' | 'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [minOrder, setMinOrder]     = useState('')
  const [maxUses, setMaxUses]       = useState('')
  const [expiresAt, setExpiresAt]   = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/coupons')
    const data = await res.json()
    setCoupons(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setCode(''); setDiscountType('percent'); setDiscountValue(''); setMinOrder(''); setMaxUses(''); setExpiresAt(''); setError(null)
  }

  const addCoupon = async () => {
    if (!code.trim()) { setError('יש להזין קוד קופון'); return }
    if (discountType !== 'free_shipping' && !discountValue) { setError('יש להזין ערך הנחה'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code:           code.trim(),
        discount_type:  discountType,
        discount_value: discountType === 'free_shipping' ? 0 : (parseFloat(discountValue) || 0),
        min_order:      parseFloat(minOrder) || 0,
        max_uses:       maxUses ? parseInt(maxUses) : null,
        expires_at:     expiresAt || null,
        is_active:      true,
      }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'שגיאה'); return }
    resetForm(); setAdding(false); load()
  }

  const toggleActive = async (c: Coupon) => {
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    await fetch(`/api/coupons/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    })
  }

  const deleteCoupon = async (id: string) => {
    setCoupons(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/coupons/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-gold" strokeWidth={1.5} />
          <h3>קופונים</h3>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5">
          <Plus size={13} /> קופון חדש
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-cream/50 dark:bg-navy-deeper/50 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1">קוד *</div>
              <input className="input text-sm w-full ltr uppercase" placeholder="MEZU10" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())} dir="ltr" />
            </div>
            <div>
              <div className="label mb-1">סוג הנחה</div>
              <select className="input text-sm w-full" value={discountType}
                onChange={e => setDiscountType(e.target.value as any)}>
                <option value="percent">אחוז הנחה (%)</option>
                <option value="fixed">סכום קבוע (₪)</option>
                <option value="free_shipping">משלוח חינם</option>
              </select>
            </div>
          </div>

          {discountType !== 'free_shipping' && (
            <div>
              <div className="label mb-1">{discountType === 'percent' ? 'אחוז הנחה' : 'סכום הנחה (₪)'}</div>
              <input className="input text-sm w-full ltr" type="number" min="0"
                placeholder={discountType === 'percent' ? '10' : '20'}
                value={discountValue} onChange={e => setDiscountValue(e.target.value)} dir="ltr" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="label mb-1">מינימום הזמנה (₪)</div>
              <input className="input text-sm w-full ltr" type="number" min="0" placeholder="0"
                value={minOrder} onChange={e => setMinOrder(e.target.value)} dir="ltr" />
            </div>
            <div>
              <div className="label mb-1">מקסימום שימושים</div>
              <input className="input text-sm w-full ltr" type="number" min="1" placeholder="ללא הגבלה"
                value={maxUses} onChange={e => setMaxUses(e.target.value)} dir="ltr" />
            </div>
            <div>
              <div className="label mb-1">תוקף עד</div>
              <input className="input text-sm w-full ltr" type="date"
                value={expiresAt} onChange={e => setExpiresAt(e.target.value)} dir="ltr" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={addCoupon} disabled={saving} className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
              {saving ? 'שומר...' : 'צור קופון'}
            </button>
            <button onClick={() => { setAdding(false); resetForm() }} className="btn-secondary text-xs px-4 py-2">ביטול</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? <div className="text-sm text-muted">טוען...</div> : (
        <div className="space-y-2">
          {coupons.length === 0 && !adding && (
            <div className="text-sm text-muted text-center py-4">אין קופונים — הוסף את הראשון</div>
          )}
          {coupons.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-cream/40 dark:bg-navy-deeper/50 rounded-xl px-3 py-2.5">
              <span className={cn('font-mono text-sm font-bold ltr', !c.is_active && 'line-through text-muted')}>{c.code}</span>
              <span className="text-xs text-muted">
                {TYPE_LABELS[c.discount_type]}
                {c.discount_type !== 'free_shipping' && ` ${c.discount_value}${c.discount_type === 'percent' ? '%' : '₪'}`}
              </span>
              {c.min_order > 0 && <span className="text-[10px] text-muted">מינימום ₪{c.min_order}</span>}
              <span className="text-[10px] text-muted">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''} שימושים</span>
              <div className="flex-1" />
              <button onClick={() => toggleActive(c)}
                className={cn('text-[10px] px-2 py-0.5 rounded-full', c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                {c.is_active ? 'פעיל' : 'מושבת'}
              </button>
              <button onClick={() => deleteCoupon(c.id)} className="text-muted hover:text-red-500 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
