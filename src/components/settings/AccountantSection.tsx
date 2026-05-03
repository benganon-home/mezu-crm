'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, MessageCircle } from 'lucide-react'

export function AccountantSection() {
  const [name, setName]     = useState('')
  const [phone, setPhone]   = useState('')
  const [loading, setLoad]  = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    fetch('/api/app-settings?key=accountant')
      .then(r => r.json())
      .then(({ value }) => {
        if (value) { setName(value.name || ''); setPhone(value.phone || '') }
      })
      .finally(() => setLoad(false))
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/app-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'accountant', value: { name: name.trim(), phone: phone.trim() } }),
    })
    setSaving(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle size={16} className="text-[#25D366]" strokeWidth={1.5} />
        <h3>פרטי רואה החשבון</h3>
      </div>
      <p className="text-xs text-muted mb-4">
        משמש בכפתור &quot;שלח לרו״ח&quot; שבעמוד הוצאות — פותח וואטסאפ עם הספק, הסכום והקישור לחשבונית.
      </p>

      {loading ? (
        <div className="text-xs text-muted">טוען...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="label mb-1.5">שם</div>
            <input className="input w-full" placeholder="למשל: נועם ינילוב" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <div className="label mb-1.5">טלפון</div>
            <input className="input w-full ltr" placeholder="0501234567" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" />
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 mt-4">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.5} />}
        {savedFlash ? 'נשמר ✓' : 'שמור'}
      </button>
    </div>
  )
}
