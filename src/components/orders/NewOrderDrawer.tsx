'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Plus, Minus, Trash2, Search, CheckCircle2, UserPlus, ChevronRight } from 'lucide-react'
import { Customer, Product, ProductSize, SalesRule, ITEM_COLOR_MAP, FONTS } from '@/types'
import { formatPrice, cn } from '@/lib/utils'
import { useDrawerAnimation } from '@/hooks/useDrawerAnimation'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NewItem {
  _id: string
  product_id?: string
  item_name: string
  model: string
  color: string
  sign_text: string
  font: string
  size: string
  price: string
  qty: number
}

interface Props {
  onClose: () => void
  onCreated: (order: any) => void
}

const COLORS = Object.entries(ITEM_COLOR_MAP)
const CATEGORY_ORDER = ['מזוזות', 'שלטי בית', 'ברכות', 'אחר']

function makeItem(item_name = '', model = '', size = '', price = ''): NewItem {
  return { _id: crypto.randomUUID(), item_name, model, color: '', sign_text: '', font: '', size, price, qty: 1 }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NewOrderDrawer({ onClose, onCreated }: Props) {
  const { visible, close } = useDrawerAnimation(onClose)
  // Customer state
  const [phone, setPhone]               = useState('')
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress]           = useState('')
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Products catalog
  const [catalog, setCatalog]           = useState<Product[]>([])
  const [pickingSize, setPickingSize]   = useState<Product | null>(null)
  const [salesRules, setSalesRules]     = useState<SalesRule[]>([])

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setCatalog(Array.isArray(d) ? d.filter(p => p.is_active) : []))
    fetch('/api/sales-rules').then(r => r.json()).then(d => setSalesRules(Array.isArray(d) ? d.filter((r: SalesRule) => r.is_active) : []))
  }, [])

  // Order state
  const [items, setItems]               = useState<NewItem[]>([])
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery')
  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const autoTotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * i.qty, 0)

  const matchingRule = useMemo(() => {
    if (items.length === 0) return null
    return salesRules.find(rule =>
      rule.conditions.every(cond => {
        const count = items
          .filter(i => i.model === cond.category && (!cond.size || i.size === cond.size))
          .reduce((s, i) => s + i.qty, 0)
        return count >= cond.min_qty
      })
    ) ?? null
  }, [items, salesRules])

  const finalTotal = useMemo(() => {
    if (!matchingRule) return autoTotal
    if (matchingRule.discount_type === 'fixed_total') {
      // Bundle price applies only to the min_qty items per condition.
      // Extra items beyond the bundle keep their full price.
      let extrasTotal = 0
      // Track how many units each condition "consumes"
      const consumed: Record<string, number> = {}
      for (const cond of matchingRule.conditions) {
        const key = `${cond.category}|${cond.size || ''}`
        consumed[key] = cond.min_qty
      }
      for (const item of items) {
        const key = `${item.model}|${item.size || ''}`
        const keyNoSize = `${item.model}|`
        const condKey = consumed[key] !== undefined ? key : consumed[keyNoSize] !== undefined ? keyNoSize : null
        if (condKey && consumed[condKey] > 0) {
          const used = Math.min(item.qty, consumed[condKey])
          consumed[condKey] -= used
          const extraQty = item.qty - used
          if (extraQty > 0) extrasTotal += (parseFloat(item.price) || 0) * extraQty
        } else {
          extrasTotal += (parseFloat(item.price) || 0) * item.qty
        }
      }
      return matchingRule.discount_value + extrasTotal
    }
    return autoTotal * (1 - matchingRule.discount_value / 100)
  }, [matchingRule, autoTotal, items])

  // Phone lookup with debounce
  const searchCustomer = useCallback(async (raw: string) => {
    const clean = raw.replace(/\D/g, '')
    if (clean.length < 9) {
      setFoundCustomer(null)
      setIsNewCustomer(false)
      return
    }
    setSearchLoading(true)
    try {
      const res  = await fetch(`/api/customers?search=${encodeURIComponent(raw)}&pageSize=10`)
      const json = await res.json()
      const match = (json.data || []).find((c: Customer) =>
        c.phone.replace(/\D/g, '') === clean
      )
      if (match) {
        setFoundCustomer(match)
        setCustomerName(match.name)
        setAddress(match.address || '')
        setIsNewCustomer(false)
      } else if (clean.length >= 10) {
        setFoundCustomer(null)
        setIsNewCustomer(true)
      }
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCustomer(phone), 400)
    return () => clearTimeout(t)
  }, [phone, searchCustomer])

  const resetCustomer = () => {
    setFoundCustomer(null)
    setIsNewCustomer(false)
    setCustomerName('')
    setAddress('')
  }

  // Items
  const addItemFromProduct = (product: Product, size?: ProductSize) => {
    const item = {
      ...makeItem(
        product.name,
        product.category || '',
        size?.label || '',
        size ? size.price.toString() : product.base_price.toString(),
      ),
      product_id: product.id,
    }
    setItems(p => [...p, item])
    setPickingSize(null)
  }

  const handleProductClick = (product: Product) => {
    if (product.sizes?.length > 1) {
      setPickingSize(prev => prev?.id === product.id ? null : product)
    } else {
      addItemFromProduct(product, product.sizes?.[0])
    }
  }

  const addItem  = (item_name: string, model: string) => setItems(p => [...p, makeItem(item_name, model)])
  const removeItem   = (id: string) => setItems(p => p.filter(i => i._id !== id))
  const updateItem   = (id: string, field: keyof NewItem, value: string) =>
    setItems(p => p.map(i => i._id === id ? { ...i, [field]: value } : i))

  // Validation
  const phoneOk    = phone.replace(/\D/g, '').length >= 9
  const customerOk = !!foundCustomer || (isNewCustomer && customerName.trim().length > 0)
  const itemsOk    = items.length > 0 && items.every(i => i.item_name.trim())
  const valid      = phoneOk && customerOk && itemsOk

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/new', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { phone, name: customerName, address: address || null },
          order:    { delivery_type: deliveryType, delivery_address: address, notes },
          items:    items.flatMap(({ _id, qty, ...rest }) => {
            const row = { ...rest, price: parseFloat(rest.price) || 0 }
            return Array.from({ length: qty }, () => ({ ...row }))
          }),
          total_price_override: matchingRule ? finalTotal : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')
      onCreated(data)
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={close}
      />

      <div className={cn('drawer flex flex-col', visible && 'open')}>

        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-white dark:bg-navy-dark border-b border-cream-dark dark:border-navy-light px-5 py-4 flex items-center justify-between">
          <h2>הזמנה חדשה</h2>
          <button onClick={close} className="text-muted hover:text-navy dark:hover:text-cream p-2 rounded">
            <X size={20} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">

          {/* ── Customer ── */}
          <section>
            <div className="label mb-2">לקוח</div>

            {/* Phone field */}
            <div className="relative">
              <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              {searchLoading && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted animate-pulse">מחפש...</span>
              )}
              <input
                className="input pr-9 ltr text-right"
                placeholder="מספר טלפון..."
                value={phone}
                onChange={e => { setPhone(e.target.value); resetCustomer() }}
                dir="ltr"
              />
            </div>

            {/* Existing customer found */}
            {foundCustomer && (
              <div className="mt-2 flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{foundCustomer.name}</div>
                  {foundCustomer.address && (
                    <div className="text-xs text-emerald-600 truncate">{foundCustomer.address}</div>
                  )}
                </div>
                <span className="text-xs text-emerald-500">לקוח קיים</span>
              </div>
            )}

            {/* New customer */}
            {isNewCustomer && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                  <UserPlus size={12} />
                  לקוח חדש — יווצר בשמירה
                </div>
                <input
                  className="input"
                  placeholder="שם הלקוח *"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </section>

          {/* ── Product picker ── */}
          <section>
            <div className="label mb-2">הוספת פריטים</div>
            <div className="bg-cream dark:bg-navy-deeper rounded-xl p-3 flex flex-col gap-2">
              {CATEGORY_ORDER.map(cat => {
                const catProducts = catalog.filter(p => (p.category || 'אחר') === cat)
                if (catProducts.length === 0) return null
                return (
                  <div key={cat}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted font-medium pt-1.5 w-16 shrink-0">{cat}:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {catProducts.map(p => {
                          const isPicking = pickingSize?.id === p.id
                          return (
                            <div key={p.id} className="flex flex-col gap-1">
                              <button
                                onClick={() => handleProductClick(p)}
                                className={cn(
                                  'text-xs px-3 py-1.5 rounded-lg border transition-all',
                                  isPicking
                                    ? 'border-gold bg-gold text-white'
                                    : 'border-cream-dark dark:border-navy-light bg-white dark:bg-navy-dark hover:border-gold hover:text-gold'
                                )}
                              >
                                {p.name}
                              </button>
                              {isPicking && (
                                <div className="flex gap-1 flex-wrap pr-0.5">
                                  {p.sizes.map(s => (
                                    <button
                                      key={s.label}
                                      onClick={() => addItemFromProduct(p, s)}
                                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-navy-dark border border-gold text-gold hover:bg-gold hover:text-white transition-all"
                                    >
                                      {s.label} — {formatPrice(s.price)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Custom item */}
              <div className="flex items-center gap-2 pt-1 border-t border-cream-dark/60 dark:border-navy-light/40 mt-1">
                <span className="w-16" />
                <button
                  onClick={() => addItem('', '')}
                  className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-cream-dark dark:border-navy-light text-muted hover:border-gold hover:text-gold transition-all flex items-center gap-1"
                >
                  <Plus size={10} /> אחר
                </button>
              </div>
            </div>
          </section>

          {/* ── Items list ── */}
          {items.length === 0 ? (
            <div className="text-center text-muted text-xs py-6 border border-dashed border-cream-dark dark:border-navy-light rounded-lg">
              לחצו על כפתור למעלה כדי להוסיף פריטים
            </div>
          ) : (
            <section className="flex flex-col gap-3">
              <div className="label">{items.reduce((s, i) => s + i.qty, 0)} {items.reduce((s, i) => s + i.qty, 0) === 1 ? 'פריט' : 'פריטים'}</div>
              {items.map(item => (
                <ItemCard
                  key={item._id}
                  item={item}
                  onChange={(f, v) => updateItem(item._id, f, v)}
                  onQtyChange={(q) => setItems(p => p.map(i => i._id === item._id ? { ...i, qty: q } : i))}
                  onRemove={() => removeItem(item._id)}
                />
              ))}
            </section>
          )}

          {/* ── Delivery ── */}
          <section>
            <div className="label mb-2">אופן קבלה</div>
            <div className="flex gap-2 mb-3">
              {(['delivery', 'pickup'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDeliveryType(t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                    deliveryType === t
                      ? 'bg-navy text-cream border-navy dark:bg-gold dark:text-navy dark:border-gold'
                      : 'border-cream-dark dark:border-navy-light text-muted hover:text-navy dark:hover:text-cream'
                  )}
                >
                  {t === 'delivery' ? 'משלוח' : 'איסוף עצמי'}
                </button>
              ))}
            </div>
            {deliveryType === 'delivery' && (
              <input
                className="input"
                placeholder="כתובת מלאה למשלוח..."
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            )}
          </section>

          {/* ── Notes ── */}
          <section>
            <div className="label mb-1.5">הערות</div>
            <textarea
              className="input min-h-[70px] resize-none"
              placeholder="הערות פנימיות על ההזמנה..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </section>

          {/* ── Total summary ── */}
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              {matchingRule && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-2.5">
                  <div>
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">מבצע פעיל: {matchingRule.name}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">
                      {matchingRule.discount_type === 'percent'
                        ? `הנחה של ${matchingRule.discount_value}% · חיסכון של ${formatPrice(autoTotal - finalTotal)}`
                        : `מחיר חבילה קבוע`
                      }
                    </div>
                  </div>
                  <div className="text-right ltr">
                    <div className="text-xs text-muted line-through">{formatPrice(autoTotal)}</div>
                    <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{formatPrice(finalTotal)}</div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between bg-navy/5 dark:bg-cream/5 rounded-lg px-4 py-3 border border-navy/10 dark:border-cream/10">
                <span className="text-sm text-muted">סה״כ לתשלום</span>
                <span className="text-2xl font-semibold text-gold ltr">{formatPrice(finalTotal)}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 bg-white dark:bg-navy-dark border-t border-cream-dark dark:border-navy-light px-5 py-4 flex gap-3">
          <button
            onClick={submit}
            disabled={!valid || saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'שומר...' : 'שמירת הזמנה'}
          </button>
          <button onClick={close} className="btn-secondary px-6">
            ביטול
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onChange,
  onQtyChange,
  onRemove,
}: {
  item: NewItem
  onChange: (field: keyof NewItem, value: string) => void
  onQtyChange: (qty: number) => void
  onRemove: () => void
}) {
  return (
    <div className="surface p-3 flex flex-col gap-2.5">

      {/* Row 1: name + model tag + price + delete */}
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 text-sm font-medium"
          placeholder="שם המוצר *"
          value={item.item_name}
          onChange={e => onChange('item_name', e.target.value)}
        />
        {item.model && (
          <span className="text-xs text-muted bg-cream dark:bg-navy-deeper px-2 py-1 rounded-md whitespace-nowrap border border-cream-dark dark:border-navy-light">
            {item.model}
          </span>
        )}
        <div className="flex items-center gap-1 ltr flex-shrink-0">
          <span className="text-sm text-muted">₪</span>
          <input
            className="input w-20 text-sm"
            placeholder="0"
            type="number"
            min={0}
            step={1}
            value={item.price}
            onChange={e => onChange('price', e.target.value)}
            dir="ltr"
          />
        </div>
        <button
          onClick={onRemove}
          className="text-muted hover:text-red-500 transition-colors flex-shrink-0"
          title="הסר פריט"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Qty counter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted flex-shrink-0">כמות:</span>
        <div className="inline-flex items-center border border-cream-dark dark:border-navy-light rounded-lg">
          <button
            onClick={() => onQtyChange(Math.max(1, item.qty - 1))}
            className="h-7 w-7 flex items-center justify-center text-muted hover:text-gold transition-colors"
          >
            <Minus size={12} />
          </button>
          <span className="w-8 text-center text-sm font-medium tabular-nums">{item.qty}</span>
          <button
            onClick={() => onQtyChange(item.qty + 1)}
            className="h-7 w-7 flex items-center justify-center text-muted hover:text-gold transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>
        {item.qty > 1 && (
          <span className="text-xs text-muted">({item.qty} שורות ייווצרו בהזמנה)</span>
        )}
      </div>

      {/* Row 2: Color circles */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted flex-shrink-0">צבע:</span>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(([name, cfg]) => (
            <button
              key={name}
              onClick={() => onChange('color', item.color === name ? '' : name)}
              title={name}
              className={cn(
                'w-6 h-6 rounded-full flex-shrink-0 transition-all hover:scale-110 border border-black/15',
                item.color === name
                  ? 'ring-2 ring-gold ring-offset-2 scale-110'
                  : 'hover:border-black/30'
              )}
              style={{ backgroundColor: cfg.hex }}
            />
          ))}
        </div>
        {item.color && (
          <span className="text-xs text-muted">{item.color}</span>
        )}
      </div>

      {/* Row 3: Sign text */}
      <input
        className="input text-sm"
        placeholder="כיתוב / חריטה..."
        value={item.sign_text}
        onChange={e => onChange('sign_text', e.target.value)}
      />

      {/* Row 4: Size + Font */}
      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          placeholder="גודל"
          value={item.size}
          onChange={e => onChange('size', e.target.value)}
        />
        <select
          className="input text-sm flex-1"
          value={item.font}
          onChange={e => onChange('font', e.target.value)}
        >
          <option value="">פונט —</option>
          {FONTS.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

    </div>
  )
}
