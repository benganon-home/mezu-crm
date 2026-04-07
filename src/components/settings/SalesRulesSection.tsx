'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { SalesRule, SalesRuleCondition, Product } from '@/types'
import { formatPrice, cn } from '@/lib/utils'

const CATEGORIES = ['מזוזות', 'שלטי בית', 'ברכות', 'אחר']

const EMPTY_RULE: {
  name: string
  conditions: SalesRuleCondition[]
  discount_type: 'percent' | 'fixed_total'
  discount_value: string
} = {
  name: '',
  conditions: [{ category: 'מזוזות', min_qty: 1 }],
  discount_type: 'percent',
  discount_value: '',
}

export function SalesRulesSection() {
  const [rules, setRules]         = useState<SalesRule[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_RULE)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [sizesMap, setSizesMap]   = useState<Record<string, string[]>>({})

  const fetchRules = async () => {
    const res = await fetch('/api/sales-rules')
    const data = await res.json()
    setRules(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const fetchSizes = async () => {
    const res = await fetch('/api/products')
    const products: Product[] = await res.json()
    if (!Array.isArray(products)) return
    const map: Record<string, Set<string>> = {}
    for (const p of products) {
      if (!p.is_active || !p.category) continue
      if (!map[p.category]) map[p.category] = new Set()
      for (const s of (p.sizes || [])) {
        if (s.label) map[p.category].add(s.label)
      }
    }
    setSizesMap(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.from(v).sort()])))
  }

  useEffect(() => { fetchRules(); fetchSizes() }, [])

  const addCondition = () =>
    setForm(f => ({ ...f, conditions: [...f.conditions, { category: 'מזוזות', min_qty: 1 }] }))

  const removeCondition = (i: number) =>
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }))

  const updateCondition = (i: number, field: keyof SalesRuleCondition, value: any) =>
    setForm(f => ({
      ...f,
      conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [field]: value } : c),
    }))

  const save = async () => {
    if (!form.name.trim() || !form.discount_value || form.conditions.length === 0) {
      setError('נא למלא את כל השדות')
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/sales-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:           form.name,
        conditions:     form.conditions,
        discount_type:  form.discount_type,
        discount_value: parseFloat(form.discount_value as string),
        is_active:      true,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setRules(prev => [data, ...prev])
    setForm(EMPTY_RULE)
    setShowForm(false)
    setSaving(false)
  }

  const toggleActive = async (rule: SalesRule) => {
    const res = await fetch(`/api/sales-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    const data = await res.json()
    if (res.ok) setRules(prev => prev.map(r => r.id === rule.id ? data : r))
  }

  const deleteRule = async (id: string) => {
    await fetch(`/api/sales-rules/${id}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3>כללי מבצע</h3>
          <p className="text-xs text-muted mt-0.5">הנחה אוטומטית בעת שילוב מוצרים בהזמנה</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(null) }}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus size={13} />
          כלל חדש
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-cream dark:bg-navy-deeper rounded-xl p-4 mb-4 flex flex-col gap-3">
          {/* Name */}
          <div>
            <div className="label mb-1">שם הכלל</div>
            <input
              className="input w-full"
              placeholder="למשל: מזוזה + שלט — מחיר חבילה"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="label mb-1.5">תנאים — כמות מינימום לפי קטגוריה</div>
            <div className="flex flex-col gap-2">
              {form.conditions.map((cond, i) => {
                const availSizes = sizesMap[cond.category] || []
                return (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <select
                      className="input w-28 shrink-0"
                      value={cond.category}
                      onChange={e => { updateCondition(i, 'category', e.target.value); updateCondition(i, 'size', null) }}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {availSizes.length > 0 && (
                      <select
                        className="input w-28 shrink-0"
                        value={cond.size || ''}
                        onChange={e => updateCondition(i, 'size', e.target.value || null)}
                      >
                        <option value="">כל הגדלים</option>
                        {availSizes.map(s => <option key={s} value={s}>{s} ס״מ</option>)}
                      </select>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted">כמות מינ׳</span>
                      <input
                        type="number"
                        min={1}
                        className="input w-14 text-center"
                        value={cond.min_qty}
                        onChange={e => updateCondition(i, 'min_qty', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    {form.conditions.length > 1 && (
                      <button onClick={() => removeCondition(i)} className="text-muted hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
              <button
                onClick={addCondition}
                className="text-xs text-gold hover:underline text-right w-fit"
              >
                + הוסף קטגוריה נוספת
              </button>
            </div>
          </div>

          {/* Discount */}
          <div>
            <div className="label mb-1.5">הנחה</div>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-cream-dark dark:border-navy-light overflow-hidden shrink-0">
                {(['percent', 'fixed_total'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, discount_type: t }))}
                    className={cn(
                      'px-3 py-1.5 text-xs transition-colors',
                      form.discount_type === t
                        ? 'bg-gold text-white'
                        : 'text-muted hover:text-navy dark:hover:text-cream'
                    )}
                  >
                    {t === 'percent' ? '%' : '₪ מחיר קבוע'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                className="input flex-1"
                placeholder={form.discount_type === 'percent' ? 'למשל: 10' : 'למשל: 179.90'}
                value={form.discount_value}
                onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
              />
            </div>
            {form.discount_value && (
              <p className="text-xs text-muted mt-1.5">
                {form.discount_type === 'percent'
                  ? `הנחה של ${form.discount_value}% על סך ההזמנה`
                  : `מחיר סופי קבוע של ${formatPrice(parseFloat(form.discount_value as string) || 0)}`
                }
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? 'שומר...' : 'שמור כלל'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_RULE); setError(null) }}
              className="btn-secondary text-sm"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <p className="text-sm text-muted text-center py-4">טוען...</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted text-center py-4">עוד אין כללי מבצע</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                rule.is_active
                  ? 'border-gold/30 bg-gold/5'
                  : 'border-cream-dark dark:border-navy-light opacity-50'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{rule.name}</div>
                <div className="text-xs text-muted mt-0.5">
                  {rule.conditions.map(c => `${c.min_qty}× ${c.category}${c.size ? ` ${c.size}ס״מ` : ''}`).join(' + ')}
                  {' → '}
                  {rule.discount_type === 'percent'
                    ? `${rule.discount_value}% הנחה`
                    : `${formatPrice(rule.discount_value)} מחיר קבוע`
                  }
                </div>
              </div>
              <button onClick={() => toggleActive(rule)} className="text-muted hover:text-gold transition-colors shrink-0">
                {rule.is_active
                  ? <ToggleRight size={22} className="text-gold" />
                  : <ToggleLeft size={22} />
                }
              </button>
              <button onClick={() => deleteRule(rule.id)} className="text-muted hover:text-red-500 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
