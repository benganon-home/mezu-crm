// Sales rule engine — shared between CRM webhook and the new mezu-store.
// Copy this file VERBATIM into mezu-store/src/lib/sales-rules.ts.
// Do not re-implement the logic — single source of truth.

import type { SalesRule } from '@/types'

export interface RuleItem {
  model?: string | null
  size?: string | null
  price: number
  // Any other fields are preserved and carried through unchanged
  [key: string]: unknown
}

export interface ApplyRulesResult<T extends RuleItem> {
  items:         T[]          // items with updated prices (same objects, mutated + returned)
  finalTotal:    number       // final order total after discount
  appliedRule:   SalesRule | null
  autoTotal:     number       // sum of item prices before discount
}

/**
 * Apply the first matching active sales rule to the given items.
 *
 * - `fixed_total`: the discount value replaces the sum of BUNDLE items
 *   (items that satisfy the rule's min_qty per condition). Extra items
 *   outside the bundle keep their full price. Bundle item prices are
 *   distributed proportionally from the discount value.
 *
 * - `percent`: the discount value is subtracted from the whole order,
 *   proportionally distributed across every item.
 *
 * Mutates `item.price` in place on the passed items. Returns the same
 * array reference for convenience + computed totals + which rule fired.
 */
export function applySalesRules<T extends RuleItem>(
  items: T[],
  rules: SalesRule[],
): ApplyRulesResult<T> {
  const activeRules = (rules || []).filter(r => r.is_active)
  const autoTotal   = items.reduce((s, i) => s + (i.price || 0), 0)

  const appliedRule = activeRules.find(rule =>
    rule.conditions.every(cond => {
      const count = items.filter(i =>
        i.model === cond.category && (!cond.size || i.size === cond.size)
      ).length
      return count >= cond.min_qty
    })
  ) ?? null

  if (!appliedRule) {
    return { items, finalTotal: autoTotal, appliedRule: null, autoTotal }
  }

  if (appliedRule.discount_type === 'fixed_total') {
    // Mark bundle items (first min_qty items that match each condition)
    const usedIndices = new Set<number>()
    appliedRule.conditions.forEach(cond => {
      let needed = cond.min_qty
      items.forEach((item, idx) => {
        if (needed > 0 && !usedIndices.has(idx)
            && item.model === cond.category
            && (!cond.size || item.size === cond.size)) {
          usedIndices.add(idx)
          needed--
        }
      })
    })

    const bundleAutoTotal = items.reduce(
      (s, i, idx) => usedIndices.has(idx) ? s + (i.price || 0) : s, 0)
    const extraTotal = items.reduce(
      (s, i, idx) => !usedIndices.has(idx) ? s + (i.price || 0) : s, 0)

    if (bundleAutoTotal > 0) {
      items.forEach((item, idx) => {
        if (usedIndices.has(idx)) {
          item.price = parseFloat(
            ((item.price / bundleAutoTotal) * appliedRule.discount_value).toFixed(2)
          )
        }
      })
    }

    return {
      items,
      finalTotal:  appliedRule.discount_value + extraTotal,
      appliedRule,
      autoTotal,
    }
  }

  // percent discount — applies to every item proportionally
  const finalTotal = autoTotal * (1 - appliedRule.discount_value / 100)
  if (autoTotal > 0) {
    items.forEach(i => {
      i.price = parseFloat(((i.price / autoTotal) * finalTotal).toFixed(2))
    })
  }

  return { items, finalTotal, appliedRule, autoTotal }
}
