'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, MessageCircle, ChevronLeft } from 'lucide-react'
import { Customer } from '@/types'
import { formatDate, formatPrice, formatPhone, buildWaLink, cn } from '@/lib/utils'
import { CopyButton } from '@/components/ui/CopyButton'
import { CustomerDrawer } from '@/components/customers/CustomerDrawer'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [count, setCount]         = useState(0)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [active, setActive]       = useState<Customer | null>(null)
  const [page, setPage]           = useState(1)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ search, page: String(page), pageSize: '60' })
    const res  = await fetch(`/api/customers?${params}`)
    const json = await res.json()
    setCustomers(json.data || [])
    setCount(json.count || 0)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetch_() }, [fetch_])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetch_() }, 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line

  return (
    <div className="flex flex-col gap-5">

      <div className="page-header">
        <div>
          <h1>לקוחות</h1>
          <p className="text-xs text-muted mt-0.5">{count} לקוחות</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input pr-9"
          placeholder="חיפוש לפי שם או טלפון..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="surface overflow-hidden">
        <table className="crm-table">
          <thead>
            <tr>
              <th>לקוח</th>
              <th>כתובת</th>
              <th className="text-center">הזמנות</th>
              <th className="text-left">סה״כ הוצאה</th>
              <th className="text-left">הזמנה אחרונה</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12 text-muted">טוען...</td></tr>
            )}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted">לא נמצאו לקוחות</td></tr>
            )}
            {customers.map(c => (
              <tr key={c.id} onClick={() => setActive(c)}>
                <td>
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-navy/10 dark:bg-cream/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-navy dark:text-cream">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="ltr text-xs text-muted">{formatPhone(c.phone)}</span>
                        <CopyButton text={c.phone} />
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="text-xs text-muted truncate max-w-[160px] block">{c.address || '—'}</span>
                </td>
                <td className="text-center">
                  <span className="text-sm font-medium">{c.total_orders ?? 0}</span>
                </td>
                <td className="text-left">
                  <span className="ltr text-sm font-medium text-gold">{formatPrice(c.total_spent ?? 0)}</span>
                </td>
                <td className="text-left">
                  <span className="ltr text-xs text-muted">
                    {c.last_order_at ? formatDate(c.last_order_at) : '—'}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                    <a
                      href={buildWaLink(c.phone, `שלום ${c.name}, `)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-[#25D366] transition-colors"
                      title="WhatsApp"
                    >
                      <MessageCircle size={15} strokeWidth={1.5} />
                    </a>
                    <ChevronLeft size={14} className="text-muted" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-cream-dark dark:border-navy-light text-xs text-muted">
          <span>מציג {customers.length} מתוך {count}</span>
          <div className="flex gap-1">
            {Array.from({ length: Math.ceil(count / 60) }, (_, i) => i + 1).slice(0, 7).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn('w-7 h-7 rounded text-xs',
                  page === p ? 'bg-navy text-cream dark:bg-gold dark:text-navy' : 'hover:bg-cream dark:hover:bg-navy-light'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {active && (
        <CustomerDrawer
          customer={active}
          onClose={() => setActive(null)}
          onUpdate={c => { setActive(c); setCustomers(prev => prev.map(x => x.id === c.id ? c : x)) }}
        />
      )}
    </div>
  )
}
