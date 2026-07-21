'use client'

// חומרי גלם — filament inventory per color.
// Stock = movement ledger (spools bought, prints deducted automatically when
// an item reaches 'מוכן', manual adjustments). Demand = open items
// (התקבלה/בהכנה) weighed via product weights, editable at the bottom.

import { useEffect, useMemo, useState } from 'react'
import { Plus, AlertTriangle, ChevronDown, ChevronUp, Disc3, Scale } from 'lucide-react'
import type { FilamentSummary, Product } from '@/types'
import { cn } from '@/lib/utils'
import { dottedStyle } from '@/lib/colorPattern'
import { useProductColors, resolveColor } from '@/lib/productColors'

interface UnmappedColor { color: string; demand_items: number; unknown_weight_items: number; demand_g: number }

const kg = (g: number) => `${(g / 1000).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ק״ג`

const STATUS_BADGE: Record<FilamentSummary['status'], { label: string; cls: string }> = {
  ok:    { label: 'תקין',            cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  low:   { label: 'נמוך',            cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  order: { label: 'להזמין פילמנט!',  cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
}

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<FilamentSummary[]>([])
  const [unmapped, setUnmapped]   = useState<UnmappedColor[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [showWeights, setShowWeights]   = useState(false)
  const [newColor, setNewColor]   = useState('')

  const fetchAll = async () => {
    const [f, p] = await Promise.all([
      fetch('/api/filaments').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
    ])
    setFilaments(Array.isArray(f?.filaments) ? f.filaments : [])
    setUnmapped(Array.isArray(f?.unmapped) ? f.unmapped : [])
    setProducts(Array.isArray(p) ? p.filter((x: Product) => x.is_active) : [])
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  const active   = useMemo(() => filaments.filter(f => f.is_active), [filaments])
  const inactive = useMemo(() => filaments.filter(f => !f.is_active), [filaments])
  const needOrder = active.filter(f => f.status === 'order')
  const totalStock = active.reduce((s, f) => s + f.stock_g, 0)
  const unknownTotal = active.reduce((s, f) => s + f.unknown_weight_items, 0)
    + unmapped.reduce((s, u) => s + u.unknown_weight_items, 0)

  const addColor = async () => {
    const color = newColor.trim()
    if (!color) return
    setNewColor('')
    await fetch('/api/filaments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    })
    fetchAll()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1>חומרי גלם</h1>
          <p className="text-xs text-muted mt-0.5">
            {active.length} צבעים פעילים · {kg(totalStock)} במלאי
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addColor()}
            placeholder="צבע חדש…"
            className="input text-sm w-40"
          />
          <button onClick={addColor} disabled={!newColor.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Plus size={14} strokeWidth={1.5} /> הוספה
          </button>
        </div>
      </div>

      {/* Reorder alert */}
      {needOrder.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" strokeWidth={1.8} />
          <div>
            <span className="font-semibold">צריך להזמין פילמנט:</span>{' '}
            {needOrder.map(f => `${f.color} (חסרים ${kg(Math.abs(f.projected_g))})`).join(' · ')}
          </div>
        </div>
      )}

      {/* Unknown weights warning */}
      {unknownTotal > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          {unknownTotal} פריטים פתוחים בלי משקל מוגדר — הצפי חלקי. השלימו משקלים בטבלה למטה.
        </div>
      )}

      {/* Unmapped colors */}
      {unmapped.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300">
          צבעים בהזמנות פתוחות ללא פילמנט מוגדר: {unmapped.map(u => `${u.color} (${u.demand_items})`).join(' · ')}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted">טוען…</div>
      ) : active.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Disc3 size={28} className="text-muted" strokeWidth={1.5} />
          <p className="text-sm text-muted">אין צבעים פעילים — הוסיפו צבע ראשון</p>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_110px_130px_110px_120px_auto] items-center gap-2 border-b border-line px-4 py-2 text-[11px] uppercase tracking-wide text-muted">
            <span>צבע</span>
            <span className="text-left ltr">במלאי</span>
            <span className="text-left ltr">להזמנות פתוחות</span>
            <span className="text-left ltr">צפי נותר</span>
            <span>סטטוס</span>
            <span />
          </div>
          <div className="divide-y divide-line">
            {active.map(f => (
              <FilamentRow key={f.id} f={f} onChanged={fetchAll} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div>
          <button onClick={() => setShowInactive(v => !v)} className="flex items-center gap-1.5 text-xs text-muted hover:text-navy dark:hover:text-cream">
            {showInactive ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            צבעים לא פעילים ({inactive.length})
          </button>
          {showInactive && (
            <div className="surface mt-2 divide-y divide-line overflow-hidden opacity-70">
              {inactive.map(f => <FilamentRow key={f.id} f={f} onChanged={fetchAll} />)}
            </div>
          )}
        </div>
      )}

      {/* Product weights editor */}
      <div className="surface overflow-hidden">
        <button
          onClick={() => setShowWeights(v => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-right"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Scale size={15} strokeWidth={1.6} className="text-gold" />
            משקלי מוצרים (גרם)
          </span>
          {showWeights ? <ChevronUp size={15} className="text-muted" /> : <ChevronDown size={15} className="text-muted" />}
        </button>
        {showWeights && <WeightsEditor products={products} onSaved={fetchAll} />}
      </div>
    </div>
  )
}

// ─── Single filament row ─────────────────────────────────────────────

function FilamentRow({ f, onChanged }: { f: FilamentSummary; onChanged: () => void }) {
  const colors = useProductColors()
  const swatch = resolveColor(f.color, colors)
  const badge = STATUS_BADGE[f.status]
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const addSpool = async () => {
    setBusy(true)
    await fetch(`/api/filaments/${f.id}/movements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grams_delta: f.spool_grams, reason: 'purchase', note: 'גליל חדש' }),
    })
    setBusy(false)
    onChanged()
  }

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-2 md:grid-cols-[1fr_110px_130px_110px_120px_auto] items-center gap-2">
        {/* Color */}
        <div className="flex items-center gap-2 min-w-0 col-span-2 md:col-span-1">
          <span
            className={cn('h-4 w-4 rounded-full shrink-0', (swatch?.has_border ?? true) && 'border border-black/15')}
            style={dottedStyle(swatch?.hex ?? '#C8C5D8', swatch?.has_dots)}
          />
          <span className="truncate text-sm font-medium">{f.color}</span>
          {f.unknown_weight_items > 0 && (
            <span title={`${f.unknown_weight_items} פריטים ללא משקל — הצפי חלקי`}>
              <AlertTriangle size={12} className="text-amber-500 shrink-0" />
            </span>
          )}
        </div>

        <div className="ltr text-left text-sm font-semibold tabular-nums">{kg(f.stock_g)}</div>
        <div className="ltr text-left text-sm tabular-nums text-muted">
          {f.demand_g > 0 || f.demand_items > 0 ? <>−{kg(f.demand_g)} <span className="text-[10px]">({f.demand_items} פריטים)</span></> : '—'}
        </div>
        <div className={cn('ltr text-left text-sm font-semibold tabular-nums', f.projected_g < 0 && 'text-red-600 dark:text-red-400')}>
          {kg(f.projected_g)}
        </div>

        <div>
          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', badge.cls)}>{badge.label}</span>
        </div>

        <div className="flex items-center justify-end gap-1.5 col-span-2 md:col-span-1">
          <button onClick={addSpool} disabled={busy} className="btn-secondary !px-2.5 !py-1 text-xs flex items-center gap-1 disabled:opacity-50" title={`הוספת גליל (${f.spool_grams} גרם)`}>
            <Plus size={12} /> גליל
          </button>
          <button onClick={() => setEditing(v => !v)} className="btn-ghost !px-2 !py-1 text-xs">
            {editing ? 'סגירה' : 'עריכה'}
          </button>
        </div>
      </div>

      {editing && <FilamentEditor f={f} onChanged={() => { setEditing(false); onChanged() }} />}
    </div>
  )
}

function FilamentEditor({ f, onChanged }: { f: FilamentSummary; onChanged: () => void }) {
  const [stockKg, setStockKg]         = useState(String(f.stock_g / 1000))
  const [spoolG, setSpoolG]           = useState(String(f.spool_grams))
  const [thresholdKg, setThresholdKg] = useState(String(f.threshold_grams / 1000))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const targetG = Math.round(Number(stockKg) * 1000)
    const delta = targetG - f.stock_g
    const calls: Promise<Response>[] = [
      fetch(`/api/filaments/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spool_grams: Number(spoolG) > 0 ? Number(spoolG) : 1000,
          threshold_grams: Math.max(0, Math.round(Number(thresholdKg) * 1000)),
        }),
      }),
    ]
    if (Number.isFinite(targetG) && delta !== 0) {
      calls.push(fetch(`/api/filaments/${f.id}/movements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grams_delta: delta, reason: 'adjustment', note: 'עדכון ידני' }),
      }))
    }
    await Promise.all(calls)
    setBusy(false)
    onChanged()
  }

  const toggleActive = async () => {
    setBusy(true)
    await fetch(`/api/filaments/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !f.is_active }),
    })
    setBusy(false)
    onChanged()
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-cream/60 dark:bg-navy-light/20 p-3">
      <div>
        <label className="label mb-1 block text-[10px]">מלאי בפועל (ק״ג)</label>
        <input className="input w-24 text-sm ltr" inputMode="decimal" value={stockKg} onChange={e => setStockKg(e.target.value)} />
      </div>
      <div>
        <label className="label mb-1 block text-[10px]">גודל גליל (גרם)</label>
        <input className="input w-24 text-sm ltr" inputMode="numeric" value={spoolG} onChange={e => setSpoolG(e.target.value)} />
      </div>
      <div>
        <label className="label mb-1 block text-[10px]">סף התראה (ק״ג)</label>
        <input className="input w-24 text-sm ltr" inputMode="decimal" value={thresholdKg} onChange={e => setThresholdKg(e.target.value)} />
      </div>
      <button onClick={save} disabled={busy} className="btn-primary !py-2 text-xs disabled:opacity-50">שמירה</button>
      <button onClick={toggleActive} disabled={busy} className="btn-ghost !py-2 text-xs text-muted">
        {f.is_active ? 'השבתת צבע' : 'הפעלת צבע'}
      </button>
    </div>
  )
}

// ─── Product weights editor ──────────────────────────────────────────

const CATEGORY_ORDER = ['מזוזות', 'שלטי בית', 'ברכות', 'אקססוריז', 'אחר']

function WeightsEditor({ products, onSaved }: { products: Product[]; onSaved: () => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of products) {
      const cat = p.category || 'אחר'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    }
    return [...map.entries()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a[0]); const ib = CATEGORY_ORDER.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [products])

  return (
    <div className="border-t border-line">
      <p className="px-4 pt-3 text-xs text-muted">
        משקל בגרם לכל מוצר ומידה — נשמר אוטומטית ביציאה מהשדה. מוצר בלי מידות מקבל משקל אחד.
      </p>
      {groups.map(([cat, prods]) => (
        <div key={cat}>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-muted">{cat}</div>
          <div className="divide-y divide-line/60">
            {prods.map(p => <WeightRow key={p.id} product={p} onSaved={onSaved} />)}
          </div>
        </div>
      ))}
      <div className="h-3" />
    </div>
  )
}

function WeightRow({ product: p, onSaved }: { product: Product; onSaved: () => void }) {
  const sizeKeys = p.sizes?.length ? p.sizes.map(s => s.label) : ['default']
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(sizeKeys.map(k => [k, p.weights?.[k] != null ? String(p.weights![k]) : '']))
  )
  const [saved, setSaved] = useState(false)

  const save = async () => {
    const next: Record<string, number> = { ...(p.weights || {}) }
    for (const k of sizeKeys) {
      const v = Number(weights[k])
      if (Number.isFinite(v) && v > 0) next[k] = v
      else delete next[k]
    }
    await fetch(`/api/products/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weights: next }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onSaved()
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
      <span className="w-44 truncate text-sm font-medium">{p.name}</span>
      <div className="flex flex-wrap items-center gap-3">
        {sizeKeys.map(k => (
          <label key={k} className="flex items-center gap-1.5 text-xs text-muted">
            {k === 'default' ? 'משקל' : k === 'רגיל' ? 'רגיל' : `${k} ס״מ`}
            <input
              className="input !w-20 !py-1 text-sm ltr"
              inputMode="numeric"
              placeholder="גרם"
              value={weights[k]}
              onChange={e => setWeights(w => ({ ...w, [k]: e.target.value }))}
              onBlur={save}
            />
          </label>
        ))}
      </div>
      {saved && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">נשמר ✓</span>}
    </div>
  )
}
