// Sales rule engine — shared between CRM webhook, CRM /api/orders/new,
// and mezu-store cart preview / checkout.
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

export interface AppliedRule {
  rule:        SalesRule
  itemIndices: number[]   // indexes into the items array consumed by this rule
  savings:     number     // how much this rule saved (autoTotal_for_consumed - finalTotal_for_consumed)
}

export interface ApplyRulesResult<T extends RuleItem> {
  items:         T[]                 // items with updated prices (same objects, mutated + returned)
  finalTotal:    number              // sum of all items' final prices
  appliedRules:  AppliedRule[]       // every matching rule that fired (in order tried)
  appliedRule:   SalesRule | null    // backward-compat: first applied rule, or null
  autoTotal:     number              // sum of item prices before any discount
}

/**
 * Apply EVERY matching active sales rule to the given items.
 *
 * Engine semantics:
 * - Rules are tried in their order in the input array (which the CRM stores
 *   as created_at ASC). Each rule consumes items matching its conditions;
 *   consumed items can't be reused by a later rule. So a 18cm-mezuzah +
 *   sign cart will trigger the 18 bundle once, and a separate 24cm + 2nd
 *   sign in the same cart will trigger the 24 bundle independently.
 * - A rule is applied at most ONCE per call. Multi-pair carts (2× of the
 *   same combo) only get the bundle once today; multiplying is a future
 *   feature when business asks for it.
 *
 * `fixed_total`:
 * - Convention: the FIRST condition's items absorb the discount; items
 *   matched by subsequent conditions keep their full retail price.
 * - This matches how the business sells the bundle: the doorsign stays at
 *   ₪99.90 (its real value) and the mezuzah is the "discounted" piece.
 * - target_for_first_cond = discount_value − Σ(retail of other-condition items)
 *   distributed proportionally across the first-condition items.
 *
 * `percent`:
 * - Discount value (0-100) applied proportionally across every consumed item.
 *
 * Mutates `item.price` in place. Returns the same array reference + summary.
 */
export function applySalesRules<T extends RuleItem>(
  items: T[],
  rules: SalesRule[],
): ApplyRulesResult<T> {
  const activeRules = (rules || []).filter(r => r.is_active)
  const autoTotal   = items.reduce((s, i) => s + (i.price || 0), 0)

  const consumed = new Set<number>()
  const appliedRules: AppliedRule[] = []

  for (const rule of activeRules) {
    // Try to satisfy every condition with currently-unconsumed items
    const conditionAssignments: number[][] = []
    let canApply = true

    for (const cond of rule.conditions) {
      const matching: number[] = []
      for (let idx = 0; idx < items.length && matching.length < cond.min_qty; idx++) {
        if (consumed.has(idx)) continue
        const item = items[idx]
        if (item.model !== cond.category) continue
        if (cond.size && item.size !== cond.size) continue
        matching.push(idx)
      }
      if (matching.length < cond.min_qty) {
        canApply = false
        break
      }
      conditionAssignments.push(matching)
    }

    if (!canApply) continue

    const allConsumed = conditionAssignments.flat()
    allConsumed.forEach(i => consumed.add(i))

    const consumedRetailSum = allConsumed.reduce((s, idx) => s + (items[idx].price || 0), 0)

    if (rule.discount_type === 'fixed_total') {
      // First condition absorbs the discount; the rest keep retail.
      const firstCondIndices = conditionAssignments[0] || []
      const otherIndices     = conditionAssignments.slice(1).flat()
      const otherRetail      = otherIndices.reduce((s, idx) => s + (items[idx].price || 0), 0)
      const firstCondTarget  = Math.max(0, Number(rule.discount_value) - otherRetail)
      const firstCondRetail  = firstCondIndices.reduce((s, idx) => s + (items[idx].price || 0), 0)

      if (firstCondRetail > 0 && firstCondIndices.length > 0) {
        firstCondIndices.forEach(idx => {
          items[idx].price = parseFloat(
            ((items[idx].price / firstCondRetail) * firstCondTarget).toFixed(2)
          )
        })
      }
      // Other items: leave as-is (they keep retail).

      appliedRules.push({
        rule,
        itemIndices: allConsumed,
        savings:     parseFloat((firstCondRetail - firstCondTarget).toFixed(2)),
      })
    } else if (rule.discount_type === 'percent') {
      const target = consumedRetailSum * (1 - Number(rule.discount_value) / 100)
      if (consumedRetailSum > 0) {
        allConsumed.forEach(idx => {
          items[idx].price = parseFloat(
            ((items[idx].price / consumedRetailSum) * target).toFixed(2)
          )
        })
      }
      appliedRules.push({
        rule,
        itemIndices: allConsumed,
        savings:     parseFloat((consumedRetailSum - target).toFixed(2)),
      })
    }
  }

  const finalTotal = items.reduce((s, i) => s + (i.price || 0), 0)

  return {
    items,
    finalTotal,
    appliedRules,
    appliedRule: appliedRules[0]?.rule ?? null,
    autoTotal,
  }
}
