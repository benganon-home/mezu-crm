'use client'

import { useState, useRef } from 'react'
import { X, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onClose: () => void
  onImported: () => void
}

interface ImportResult {
  upserted?: number
  inserted?: number
  skipped?: number
  total_processed?: number
  error?: string
}

export function ImportXlsxModal({ onClose, onImported }: Props) {
  const [file, setFile]         = useState<File | null>(null)
  const [busy, setBusy]         = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    if (!file) return
    setBusy(true)
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/expenses/import', { method: 'POST', body: fd })
    const data = await res.json()
    setBusy(false)
    setResult(data)
    if (res.ok) onImported()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="surface w-full max-w-md p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">ייבוא מאקסל</h3>
          <button onClick={onClose} className="text-muted hover:text-navy dark:hover:text-cream">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted">
          הקובץ צריך לכלול את העמודות:
          <span className="block mt-1 ltr text-[11px]">שם ספק · סכום · מספר מסמך · תאריך מסמך · תאריך יצירה · מספר סידורי · מספור אישי · הערות</span>
          הייבוא מזהה לפי <code className="text-[11px]">מספר סידורי</code> ולא יצור כפילויות אם מריצים שוב.
        </p>

        <button
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-xl transition-colors text-sm',
            file
              ? 'border-gold bg-gold/5 text-navy dark:text-cream'
              : 'border-cream-dark dark:border-navy-light text-muted hover:border-gold',
          )}
        >
          <Upload size={16} />
          {file ? file.name : 'בחר קובץ XLSX'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { setFile(e.target.files?.[0] || null); setResult(null) }}
        />

        {result && (
          <div className={cn(
            'rounded-lg px-3 py-2.5 text-sm flex items-start gap-2',
            result.error
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
          )}>
            {result.error ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
            <div className="flex-1">
              {result.error
                ? result.error
                : (
                  <>
                    הייבוא הצליח —{' '}
                    {result.upserted ? `${result.upserted} עודכנו` : ''}
                    {result.upserted && result.inserted ? ' · ' : ''}
                    {result.inserted ? `${result.inserted} חדשים` : ''}
                    {result.skipped ? ` · ${result.skipped} דולגו` : ''}
                  </>
                )
              }
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={!file || busy}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? 'מייבא...' : 'ייבא'}
          </button>
          <button onClick={onClose} className="btn-secondary">סגור</button>
        </div>
      </div>
    </div>
  )
}
