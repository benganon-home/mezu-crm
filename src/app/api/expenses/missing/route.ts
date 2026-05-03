// Returns recurring templates that are "missing" this month —
// i.e. the expected day has already passed AND no expense exists for the same vendor.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isRecurringMissingThisMonth } from '@/lib/expenses'
import type { Expense, RecurringExpense } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const today = new Date()
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: templates, error: tErr }, { data: monthExpenses, error: eErr }] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select(`*, category:expense_categories(*)`)
      .eq('is_active', true)
      .order('expected_day_of_month', { ascending: true, nullsFirst: false }),
    supabase
      .from('expenses')
      .select('*')
      .gte('document_date', monthStart)
      .lt('document_date', monthEndStr)
      .eq('status', 'active'),
  ])

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const missing = ((templates || []) as RecurringExpense[]).filter(t =>
    isRecurringMissingThisMonth(t, (monthExpenses as Expense[]) || [], today),
  )

  return NextResponse.json({ data: missing, today: today.toISOString().slice(0, 10) })
}
