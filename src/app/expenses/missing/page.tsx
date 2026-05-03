'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, Plus, Repeat } from 'lucide-react'
import { RecurringExpense, ExpenseCategory } from '@/types'
import { formatPrice } from '@/lib/utils'
import { ExpenseDrawer } from '@/components/expenses/ExpenseDrawer'

export default function MissingExpensesPage() {
  const [missing, setMissing]       = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [today, setToday]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState<RecurringExpense | null>(null)

  const load = async () => {
    setLoading(true)
    const [mRes, cRes] = await Promise.all([
      fetch('/api/expenses/missing'),
      fetch('/api/expense-categories'),
    ])
    const mJson = await mRes.json()
    setMissing(mJson.data || [])
    setToday(mJson.today || '')
    setCategories(await cRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Link href="/expenses" className="text-muted hover:text-navy dark:hover:text-cream"><ArrowRight size={16} /></Link>
          <div>
            <h1>הוצאות חסרות החודש</h1>
            <p className="text-xs text-muted mt-0.5">לפי תבניות קבועות</p>
          </div>
        </div>
        <Link href="/expenses/recurring" className="btn-secondary flex items-center gap-2 text-sm">
          <Repeat size={14} strokeWidth={1.5} /> נהל תבניות
        </Link>
      </div>

      {loading && <div className="text-sm text-muted">טוען...</div>}

      {!loading && missing.length === 0 && (
        <div className="surface text-center py-12 text-emerald-700 dark:text-emerald-300 text-sm">
          ✓ כל ההוצאות הקבועות נרשמו החודש
        </div>
      )}

      <div className="flex flex-col gap-2">
        {missing.map(r => (
          <div key={r.id} className="surface px-3 py-3 flex items-center gap-3 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{r.vendor}</span>
                {r.category && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: r.category.color + '22', color: r.category.color }}>
                    {r.category.name_he}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-2">
                {r.expected_day_of_month && <span>צפוי ביום {r.expected_day_of_month}</span>}
                {r.expected_amount && <span className="ltr">· {formatPrice(Number(r.expected_amount))}</span>}
              </div>
            </div>
            <button
              onClick={() => setCreating(r)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus size={12} /> רשום
            </button>
          </div>
        ))}
      </div>

      {creating && (
        <ExpenseDrawer
          expense={null}
          categories={categories}
          initialValues={{
            vendor:       creating.vendor,
            amount:       creating.expected_amount ?? undefined,
            category_id:  creating.category_id ?? undefined,
          }}
          onClose={() => setCreating(null)}
          onSaved={() => { setCreating(null); load() }}
        />
      )}
    </div>
  )
}
