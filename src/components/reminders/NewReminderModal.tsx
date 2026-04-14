'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Phone, MessageCircle, Bell, Loader2, Search } from 'lucide-react'
import { Reminder, ReminderType } from '@/types'
import { cn } from '@/lib/utils'

interface CustomerOption {
  id: string
  name: string
  phone: string
}

interface Props {
  onClose:  () => void
  onSaved:  (reminder: Reminder) => void
  initial?: Reminder | null
}

const TYPE_OPTIONS: { value: ReminderType; label: string; icon: React.ReactNode }[] = [
  { value: 'call',     label: 'שיחה',    icon: <Phone size={13} strokeWidth={1.5} /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={13} strokeWidth={1.5} /> },
  { value: 'task',     label: 'משימה',   icon: <Bell size={13} strokeWidth={1.5} /> },
]

export function NewReminderModal({ onClose, onSaved, initial }: Props) {
  const isEdit = !!initial?.id

  const [customerSearch,  setCustomerSearch]  = useState(initial?.customer?.name ?? '')
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(
    initial?.customer ? { id: initial.customer.id, name: initial.customer.name, phone: initial.customer.phone } : null
  )
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching,    setSearching]    = useState(false)

  const [type,    setType]    = useState<ReminderType>(initial?.type ?? 'task')
  const [content, setContent] = useState(initial?.content ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const searchRef = useRef<HTMLDivElement>(null)

  // Customer typeahead
  useEffect(() => {
    if (selectedCustomer || customerSearch.length < 2) {
      setCustomerResults([])
      setShowDropdown(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&pageSize=8`)
        const json = await res.json()
        const results = (json.data || []).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone }))
        setCustomerResults(results)
        setShowDropdown(results.length > 0)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch, selectedCustomer])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectCustomer = (c: CustomerOption) => {
    setSelectedCustomer(c)
    setCustomerSearch(c.name)
    setCustomerResults([])
    setShowDropdown(false)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch('')
  }

  const submit = async () => {
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, any> = {
        customer_id: selectedCustomer?.id ?? null,
        type,
        content: content.trim(),
        due_date: dueDate || null,
      }
      if (isEdit) payload.id = initial!.id

      const res  = await fetch('/api/reminders', {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')

      // Attach selected customer to the returned object so the list renders it
      onSaved({ ...data, customer: selectedCustomer ?? data.customer ?? null })
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-navy-dark rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? 'עריכת תזכורת' : 'תזכורת חדשה'}</h3>
          <button onClick={onClose} className="text-muted hover:text-navy dark:hover:text-cream p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Customer */}
        <div>
          <div className="label mb-1.5">לקוח</div>
          {selectedCustomer ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div>
                <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{selectedCustomer.name}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 ltr">{selectedCustomer.phone}</div>
              </div>
              <button onClick={clearCustomer} className="text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-200">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <div className="relative">
                <input
                  className="input w-full ps-9"
                  placeholder="חפש לפי שם או טלפון..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onFocus={() => customerResults.length > 0 && setShowDropdown(true)}
                  dir="rtl"
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </span>
              </div>
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-navy-dark rounded-xl shadow-lg border border-[#E4E0F5] dark:border-navy-light max-h-48 overflow-y-auto">
                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-cream dark:hover:bg-navy-deeper text-sm text-right"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted text-xs ltr">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Type */}
        <div>
          <div className="label mb-1.5">סוג</div>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition-colors',
                  type === opt.value
                    ? 'bg-navy text-cream border-navy dark:bg-gold dark:text-navy dark:border-gold'
                    : 'border-cream-dark dark:border-navy-light text-muted hover:text-navy dark:hover:text-cream'
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          <div className="label mb-1.5">תוכן *</div>
          <textarea
            className="input w-full min-h-[80px] resize-none"
            placeholder="פרטי התזכורת..."
            value={content}
            onChange={e => setContent(e.target.value)}
            dir="rtl"
          />
        </div>

        {/* Due date */}
        <div>
          <div className="label mb-1.5">תאריך יעד</div>
          <input
            type="date"
            className="input w-full ltr"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            dir="ltr"
          />
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={submit}
            disabled={saving || !content.trim()}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> שומר...</> : isEdit ? 'שמור שינויים' : 'צור תזכורת'}
          </button>
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">ביטול</button>
        </div>

      </div>
    </div>
  )
}
