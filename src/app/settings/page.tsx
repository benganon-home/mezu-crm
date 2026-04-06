'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, MessageCircle, Save } from 'lucide-react'
import { SalesRulesSection } from '@/components/settings/SalesRulesSection'

const DEFAULT_TEMPLATES = {
  ready:   'שלום {שם}, ההזמנה שלך ממיזו מוכנה! 🎉 נשמח לתאם משלוח / איסוף 🙏',
  shipped: 'שלום {שם}, ההזמנה שלך ממיזו נשלחה! 📦 מספר מעקב: {מעקב}',
  invoice: 'שלום {שם}, מצורפת חשבונית עבור הזמנתך ממיזו 🧾 {חשבונית}',
}

export default function SettingsPage() {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES)
  const [saved, setSaved]         = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const saveTemplates = () => {
    localStorage.setItem('mezu_wa_templates', JSON.stringify(templates))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="page-header">
        <h1>הגדרות</h1>
      </div>

      {/* WA Templates */}
      <div className="surface p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle size={16} className="text-[#25D366]" strokeWidth={1.5} />
          <h3>תבניות WhatsApp</h3>
        </div>
        <p className="text-xs text-muted mb-4">
          משתנים זמינים: {'{שם}'}, {'{מוצר}'}, {'{מעקב}'}, {'{חשבונית}'}
        </p>

        {Object.entries(templates).map(([key, val]) => (
          <div key={key} className="mb-4">
            <label className="label block mb-1.5">
              {key === 'ready' ? 'הזמנה מוכנה' : key === 'shipped' ? 'נשלח' : 'חשבונית'}
            </label>
            <textarea
              className="input min-h-[70px] resize-none text-sm"
              value={val}
              onChange={e => setTemplates(t => ({ ...t, [key]: e.target.value }))}
            />
          </div>
        ))}

        <button onClick={saveTemplates} className="btn-primary flex items-center gap-2">
          <Save size={13} strokeWidth={1.5} />
          {saved ? 'נשמר ✓' : 'שמור תבניות'}
        </button>
      </div>

      {/* Sales Rules */}
      <SalesRulesSection />

      {/* Account */}
      <div className="surface p-5">
        <h3 className="mb-4">חשבון</h3>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
        >
          <LogOut size={14} />
          התנתקות
        </button>
      </div>
    </div>
  )
}
