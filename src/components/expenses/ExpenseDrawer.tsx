'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save, Trash2, Upload, FileText, Loader2, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Expense, ExpenseCategory, ExpenseStatus, EXPENSE_STATUS_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { useDrawerAnimation } from '@/hooks/useDrawerAnimation'

interface Props {
  expense?: Expense | null            // null = create
  categories: ExpenseCategory[]
  onClose: () => void
  onSaved: (e: Expense) => void
  onDeleted?: (id: string) => void
  // When opening as "create" you can pre-fill these (e.g. from a recurring template):
  initialValues?: Partial<Pick<Expense, 'vendor' | 'amount' | 'category_id' | 'invoice_number' | 'notes'>>
}

const today = () => new Date().toISOString().slice(0, 10)

export function ExpenseDrawer({ expense, categories, onClose, onSaved, onDeleted, initialValues }: Props) {
  const { visible, close } = useDrawerAnimation(onClose)

  const [vendor, setVendor]                 = useState(expense?.vendor || initialValues?.vendor || '')
  const [amount, setAmount]                 = useState(expense?.amount != null ? String(expense.amount) : (initialValues?.amount != null ? String(initialValues.amount) : ''))
  const [documentDate, setDocumentDate]     = useState(expense?.document_date || today())
  const [recordedAt, setRecordedAt]         = useState(expense?.recorded_at || today())
  const [invoiceNumber, setInvoiceNumber]   = useState(expense?.invoice_number || initialValues?.invoice_number || '')
  const [categoryId, setCategoryId]         = useState(expense?.category_id || initialValues?.category_id || '')
  const [status, setStatus]                 = useState<ExpenseStatus>(expense?.status || 'active')
  const [paymentMethod, setPaymentMethod]   = useState(expense?.payment_method || '')
  const [notes, setNotes]                   = useState(expense?.notes || initialValues?.notes || '')
  const [invoiceUrl, setInvoiceUrl]         = useState(expense?.invoice_url || '')

  const [saving, setSaving]                 = useState(false)
  const [uploading, setUploading]           = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setVendor(expense?.vendor || '')
    setAmount(expense?.amount != null ? String(expense.amount) : '')
    setDocumentDate(expense?.document_date || today())
    setRecordedAt(expense?.recorded_at || today())
    setInvoiceNumber(expense?.invoice_number || '')
    setCategoryId(expense?.category_id || '')
    setStatus(expense?.status || 'active')
    setPaymentMethod(expense?.payment_method || '')
    setNotes(expense?.notes || '')
    setInvoiceUrl(expense?.invoice_url || '')
  }, [expense])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
      const { error: uErr } = await supabase.storage.from('expense-invoices').upload(path, file, { upsert: false })
      if (uErr) throw uErr
      // signed URL valid for ~10 years (3650d)
      const { data: signed, error: sErr } = await supabase.storage.from('expense-invoices').createSignedUrl(path, 60 * 60 * 24 * 3650)
      if (sErr) throw sErr
      setInvoiceUrl(signed.signedUrl)
    } catch (e) {
      setError('שגיאת העלאה: ' + (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    if (!vendor.trim()) { setError('שם ספק נדרש'); return }
    setSaving(true)

    const payload = {
      vendor:         vendor.trim(),
      amount:         amount ? Number(amount) : null,
      document_date:  documentDate || null,
      recorded_at:    recordedAt || null,
      invoice_number: invoiceNumber.trim() || null,
      category_id:    categoryId || null,
      status,
      payment_method: paymentMethod || null,
      notes:          notes.trim() || null,
      invoice_url:    invoiceUrl || null,
    }

    const url    = expense ? `/api/expenses/${expense.id}` : '/api/expenses'
    const method = expense ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'שגיאה בשמירה'); return }
    onSaved(data)
    close()
  }

  const handleDelete = async () => {
    if (!expense) return
    if (!confirm(`למחוק את ההוצאה מ${expense.vendor}?`)) return
    const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDeleted?.(expense.id)
      close()
    }
  }

  return (
    <>
      <div className={cn('fixed inset-0 bg-black/30 z-40 transition-opacity', visible ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={close} />
      <div className={cn('drawer', visible && 'open')}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-navy-dark border-b border-cream-dark dark:border-navy-light px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{expense ? 'עריכת הוצאה' : 'הוצאה חדשה'}</h2>
          <button onClick={close} className="text-muted hover:text-navy dark:hover:text-cream p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">

          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Vendor */}
          <div>
            <div className="label mb-1.5">שם ספק *</div>
            <input
              className="input w-full"
              placeholder="למשל: META, K.EXPRESS, אנתרופיק"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              autoFocus
            />
          </div>

          {/* Amount + payment method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1.5">סכום (₪)</div>
              <input
                className="input w-full text-sm ltr"
                type="number"
                step="0.01"
                placeholder="כולל מע״מ"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <div className="label mb-1.5">אמצעי תשלום</div>
              <select className="input w-full text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="">—</option>
                <option value="אשראי">אשראי</option>
                <option value="העברה">העברה</option>
                <option value="מזומן">מזומן</option>
                <option value="הוראת קבע">הוראת קבע</option>
                <option value="צ׳ק">צ׳ק</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1.5">תאריך מסמך</div>
              <input className="input w-full text-sm ltr" type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)} dir="ltr" />
            </div>
            <div>
              <div className="label mb-1.5">תאריך יצירה</div>
              <input className="input w-full text-sm ltr" type="date" value={recordedAt} onChange={e => setRecordedAt(e.target.value)} dir="ltr" />
            </div>
          </div>

          {/* Category + invoice number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1.5">קטגוריה</div>
              <select className="input w-full text-sm" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">—</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name_he}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="label mb-1.5">מספר חשבונית</div>
              <input className="input w-full text-sm ltr" placeholder="—" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} dir="ltr" />
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="label mb-1.5">סטטוס</div>
            <div className="flex gap-1.5">
              {(['active', 'archived', 'duplicate_suspect'] as ExpenseStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn('chip-btn', status === s && 'chip-btn-active')}
                >
                  {EXPENSE_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice file upload */}
          <div>
            <div className="label mb-1.5">קובץ חשבונית (PDF/תמונה)</div>
            {invoiceUrl ? (
              <div className="flex items-center gap-2 surface px-3 py-2.5">
                <FileText size={16} className="text-gold shrink-0" />
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="flex-1 text-sm text-gold hover:underline truncate flex items-center gap-1">
                  פתח חשבונית <ExternalLink size={11} />
                </a>
                <button onClick={() => setInvoiceUrl('')} className="text-muted hover:text-red-500 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-cream-dark dark:border-navy-light rounded-xl hover:border-gold w-full justify-center text-sm text-muted hover:text-navy dark:hover:text-cream transition-colors"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'מעלה...' : 'העלה קובץ'}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = '' }}
            />
          </div>

          {/* Notes */}
          <div>
            <div className="label mb-1.5">הערות</div>
            <textarea
              className="input w-full text-sm min-h-[60px] resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="—"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-white dark:bg-navy-dark py-3 border-t border-cream-dark dark:border-navy-light -mx-5 px-5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 flex-1 justify-center disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {expense ? 'שמור' : 'צור'}
            </button>
            {expense && onDeleted && (
              <button onClick={handleDelete} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
