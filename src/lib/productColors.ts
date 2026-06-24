'use client'

// Shared client-side loader for the product colors defined in
// Settings → צבעי מוצרים (product_colors table). Cached at module level so the
// list is fetched once and reused by every component (pickers, order rows…),
// which means a color edited in Settings updates everywhere automatically.

import { useState, useEffect } from 'react'
import { ITEM_COLOR_MAP } from '@/types'

export interface ColorOption {
  name_he: string
  hex: string
  has_border: boolean
  has_dots: boolean
  is_active: boolean   // false = retired / sold-out ("אזל") — still selectable, just marked
}

let cache: ColorOption[] | null = null
let inflight: Promise<ColorOption[]> | null = null

export function loadProductColors(): Promise<ColorOption[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/product-colors')
      .then(r => r.json())
      .then((d: any[]) => {
        // Include inactive ("אזל") colors too — consumers decide whether to
        // mark/grey them; resolveColor also needs them to render retired colors
        // that still appear on old orders. Active colors are ordered first.
        const list = (Array.isArray(d) ? d : [])
          .map(c => ({
            name_he:    c.name_he as string,
            hex:        c.hex as string,
            has_border: !!c.has_border,
            has_dots:   !!c.has_dots,
            is_active:  c.is_active !== false,
          }))
          .sort((a, b) => Number(b.is_active) - Number(a.is_active))
        cache = list
        return list
      })
      .catch(() => {
        // Fallback to the legacy static map if the API is unavailable.
        const list = Object.entries(ITEM_COLOR_MAP).map(([name_he, { hex, border }]) => ({
          name_he, hex, has_border: !!border, has_dots: false, is_active: true,
        }))
        cache = list
        return list
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

/** Hook returning all product colors incl. inactive/"אזל" (empty until loaded). */
export function useProductColors(): ColorOption[] {
  const [colors, setColors] = useState<ColorOption[]>(cache ?? [])
  useEffect(() => {
    let alive = true
    loadProductColors().then(list => { if (alive) setColors(list) })
    return () => { alive = false }
  }, [])
  return colors
}

/**
 * Resolve a color name to its swatch, preferring the live Settings list and
 * falling back to the legacy static map (for retired colors on old orders).
 */
export function resolveColor(name: string | null | undefined, colors: ColorOption[]): ColorOption | null {
  if (!name) return null
  const known = colors.find(c => c.name_he === name)
  if (known) return known
  const legacy = ITEM_COLOR_MAP[name]
  if (legacy) return { name_he: name, hex: legacy.hex, has_border: !!legacy.border, has_dots: false, is_active: true }
  return null
}
